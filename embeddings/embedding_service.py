# embeddings/embedding_service.py
"""
Embedding pipeline for the AI Job Market Intelligence Platform.

Pipeline per call:
  1. Fetch up to BATCH_SIZE jobs from Supabase where embedding IS NULL
  2. Build a rich text representation of each job
  3. Encode with sentence-transformers/all-MiniLM-L6-v2  (dim=384)
  4. Update each job row in Supabase with its embedding vector
  5. Repeat until no un-embedded jobs remain

Usage:
    from embeddings.embedding_service import run_embedding_pipeline
    run_embedding_pipeline()
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer

from config.settings import settings
from db.supabase_client import get_client

log = logging.getLogger("embedding_service")

# ── Model (loaded once per process) ─────────────────────────────────
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Lazy-load the sentence-transformer model (singleton)."""
    global _model
    if _model is None:
        log.info("Loading embedding model '%s' …", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        log.info("Model loaded.")
    return _model


# ── Text builder ─────────────────────────────────────────────────────

def _build_text(job: dict[str, Any]) -> str:
    """
    Combine job fields into a single string for embedding.

    Format:
        Job Title: {title}
        Company: {company}
        Location: {location}
        Skills: skill1, skill2, skill3
    """
    title    = job.get("title") or ""
    company  = job.get("company") or ""
    location = job.get("location") or ""

    # cleaned_tags is a Postgres array — Supabase returns it as a Python list
    raw_tags = job.get("cleaned_tags") or []
    if isinstance(raw_tags, str):
        # Fallback: handle stringified arrays
        import ast
        try:
            raw_tags = ast.literal_eval(raw_tags)
        except (ValueError, SyntaxError):
            raw_tags = [s.strip() for s in raw_tags.split(",") if s.strip()]

    skills_str = ", ".join(raw_tags) if raw_tags else "none"

    return (
        f"Job Title: {title}\n"
        f"Company: {company}\n"
        f"Location: {location}\n"
        f"Skills: {skills_str}"
    )


# ── Supabase helpers ─────────────────────────────────────────────────

def _fetch_unembedded(batch_size: int) -> list[dict[str, Any]]:
    """
    Fetch up to `batch_size` jobs that have no embedding yet.

    Returns a list of dicts with keys: id, title, company, location, cleaned_tags.
    """
    client = get_client()
    response = (
        client
        .table("jobs")
        .select("id, title, company, location, cleaned_tags")
        .is_("embedding", "null")
        .limit(batch_size)
        .execute()
    )
    return response.data or []


def _store_embeddings(updates: list[dict[str, Any]]) -> int:
    """
    Update the embedding column for each job by its id.

    Uses individual UPDATE calls (not upsert) so that only the embedding
    column is touched — no risk of nulling required fields like source/title.

    Returns:
        Number of rows successfully updated.
    """
    client = get_client()
    stored = 0
    for item in updates:
        try:
            client.table("jobs").update(
                {"embedding": item["embedding"]}
            ).eq("id", item["id"]).execute()
            stored += 1
        except Exception as exc:
            log.error("Failed to update embedding for id=%s: %s", item["id"], exc)
    return stored


# ── Main pipeline ────────────────────────────────────────────────────

def run_embedding_pipeline() -> dict[str, int]:
    """
    Full embedding pipeline: fetch → encode → store, looping until done.

    Returns:
        Summary dict {"fetched": N, "generated": M, "stored": S}
    """
    batch_size = settings.embedding_batch_size
    total_fetched = 0
    total_stored  = 0

    try:
        model = _get_model()
    except Exception as exc:
        log.error("Failed to load embedding model: %s", exc)
        raise

    log.info("Starting embedding pipeline (batch_size=%d) …", batch_size)

    while True:
        # 1. Fetch
        try:
            jobs = _fetch_unembedded(batch_size)
        except Exception as exc:
            log.error("Failed to fetch un-embedded jobs from Supabase: %s", exc)
            break

        if not jobs:
            log.info("No jobs without embeddings — pipeline complete.")
            break

        fetched = len(jobs)
        total_fetched += fetched
        log.info("Fetched %d job(s) without embeddings.", fetched)

        # 2. Build texts
        texts = [_build_text(job) for job in jobs]

        # 3. Encode
        try:
            log.info("Generating embeddings …")
            vectors: np.ndarray = model.encode(
                texts,
                batch_size=32,          # GPU/CPU mini-batch inside the model
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,  # unit vectors → cosine sim = dot product
            )
            log.info("Embeddings generated (%s, dim=%d).", vectors.shape, vectors.shape[1])
        except Exception as exc:
            log.error("Embedding generation failed: %s", exc)
            break

        # 4. Build update payloads — Supabase expects a plain list, not numpy array
        updates = [
            {"id": job["id"], "embedding": vector.tolist()}
            for job, vector in zip(jobs, vectors)
        ]

        # 5. Store
        try:
            stored = _store_embeddings(updates)
            total_stored += stored
            log.info("Stored %d embedding(s).", stored)
        except Exception as exc:
            log.error("Failed to store embeddings in Supabase: %s", exc)
            break

        # If we got fewer than batch_size, we've processed everything
        if fetched < batch_size:
            break

    summary = {
        "fetched":   total_fetched,
        "generated": total_fetched,   # same count — we encode everything we fetch
        "stored":    total_stored,
    }
    log.info("Embedding pipeline finished. Summary: %s", summary)
    return summary
