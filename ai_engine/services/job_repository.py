# services/job_repository.py
"""
Repository layer for persisting jobs to Supabase PostgreSQL.

Handles:
  - DataFrame → dict conversion with column mapping
  - Batch upsert with on_conflict="link"
  - Retry logic (up to 3 attempts with exponential back-off)
  - Structured logging
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

from db.supabase_client import get_client
from services.geocoder import geocode_location

log = logging.getLogger("job_repository")

# ── Configuration ────────────────────────────────────────────────────
TABLE_NAME = "jobs"
BATCH_SIZE = 200  # Supabase REST has payload limits; chunk large inserts


# ── Column mapping ───────────────────────────────────────────────────
# Maps the cleaned DataFrame columns → DB columns.
# Adjust the left side if your DataFrame column names differ.
COLUMN_MAP: dict[str, str] = {
    "source":           "source",
    "title":            "title",
    "company":          "company",
    "location":         "location",
    "skills":           "tags",             # raw skills list  → tags[]
    "skills_extracted": "cleaned_tags",     # enriched skills  → cleaned_tags[]
    "link":             "link",
}


def _sanitize(value: Any) -> Any:
    """
    Convert values that are not JSON-serializable to safe equivalents:
    - float NaN / Inf  →  None  (becomes JSON null)
    - Everything else passes through unchanged.
    """
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    return value


def _prepare_records(jobs: list[dict]) -> list[dict[str, Any]]:
    """
    Transform raw job dicts (from DataFrame.to_dict) into DB-ready records.

    - Renames columns per COLUMN_MAP
    - Ensures tags / cleaned_tags are real Python lists
    - Replaces NaN / Inf with None so JSON serialization never fails
    - Adds scraped_at timestamp
    """
    import ast as _ast

    now = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, Any]] = []

    for job in jobs:
        record: dict[str, Any] = {}
        for src_col, db_col in COLUMN_MAP.items():
            value = job.get(src_col)
            # Ensure array columns are proper Python lists
            if db_col in ("tags", "cleaned_tags"):
                if isinstance(value, str):
                    try:
                        value = _ast.literal_eval(value)
                    except (ValueError, SyntaxError):
                        value = [s.strip() for s in value.split(",") if s.strip()]
                if not isinstance(value, list):
                    value = []
                # Sanitize each element inside the list
                value = [_sanitize(v) for v in value if v is not None]
            else:
                value = _sanitize(value)
            record[db_col] = value

        # Optional description column (may not exist in every scraper)
        record["description"] = _sanitize(job.get("description", None))
        record["scraped_at"] = now

        # ── Geocode location ─────────────────────────────────────
        location_text = record.get("location") or ""
        coords = geocode_location(location_text)
        if coords:
            record["latitude"] = coords[0]
            record["longitude"] = coords[1]
        else:
            record["latitude"] = None
            record["longitude"] = None

        records.append(record)

    return records

def _filter_valid(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """
    Drop records missing required NOT NULL fields (title, link, source).
    Returns (valid_records, dropped_count).
    """
    valid = []
    dropped = 0
    for r in records:
        if not r.get("title") or not r.get("link") or not r.get("source"):
            log.warning(
                "Dropping record with missing required field — link=%s title=%s",
                r.get("link"), r.get("title")
            )
            dropped += 1
        else:
            valid.append(r)
    return valid, dropped


def _chunk(lst: list, size: int):
    """Yield successive chunks of `size` from `lst`."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    before_sleep=before_sleep_log(log, logging.WARNING),
    reraise=True,
)
def _upsert_batch(records: list[dict[str, Any]]) -> int:
    """
    Upsert a single batch of records into Supabase.

    Returns:
        Number of rows affected.
    """
    client = get_client()
    response = (
        client
        .table(TABLE_NAME)
        .upsert(records, on_conflict="link")
        .execute()
    )
    return len(response.data) if response.data else 0


# ── Public API ───────────────────────────────────────────────────────

def upsert_jobs(jobs: list[dict]) -> dict[str, int]:
    """
    Upsert a list of job dicts into the Supabase ``jobs`` table.

    Handles batching, retries, and logging. Safe to call from both
    ``main.py`` and the scheduler.

    Args:
        jobs: List of dicts (typically from ``df.to_dict(orient='records')``).

    Returns:
        Summary dict: ``{"total": N, "upserted": M, "failed_batches": F}``
    """
    if not jobs:
        log.info("upsert_jobs called with empty list — nothing to do.")
        return {"total": 0, "upserted": 0, "failed_batches": 0}

    records = _prepare_records(jobs)
    records, dropped = _filter_valid(records)
    if dropped:
        log.warning("Dropped %d record(s) with missing required fields.", dropped)
    total = len(records)
    if total == 0:
        log.warning("No valid records to upsert after filtering.")
        return {"total": 0, "upserted": 0, "failed_batches": 0}
    num_batches = math.ceil(total / BATCH_SIZE)
    upserted = 0
    failed_batches = 0

    log.info(
        "Upserting %d record(s) in %d batch(es) of ≤%d …",
        total, num_batches, BATCH_SIZE,
    )

    for idx, batch in enumerate(_chunk(records, BATCH_SIZE), start=1):
        try:
            count = _upsert_batch(batch)
            upserted += count
            log.info("  Batch %d/%d — %d row(s) upserted.", idx, num_batches, count)
        except Exception as exc:
            failed_batches += 1
            log.error(
                "  Batch %d/%d FAILED after retries: %s", idx, num_batches, exc
            )

    summary = {
        "total": total,
        "upserted": upserted,
        "failed_batches": failed_batches,
    }

    if failed_batches:
        log.warning("Upsert finished with %d failed batch(es). Summary: %s", failed_batches, summary)
    else:
        log.info("Upsert complete. Summary: %s", summary)

    return summary
