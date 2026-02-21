# scheduler/cron_job.py
"""
Cron-style scheduler that fetches the latest jobs every 15 minutes.

Features:
  - Scrapes all sources (RemoteOK, WeWorkRemotely, HackerNews)
  - Cleans and normalizes new data
  - Deduplicates against previously saved jobs (title + company)
  - Appends only **new** jobs to the CSV (no overwrites, no duplicates)
  - Logs every run with a timestamp

Usage:
    python -m scheduler.cron_job          # run the 15-min loop
    python -m scheduler.cron_job --once   # run once and exit (useful for system crontab)
"""

from __future__ import annotations

import ast
import sys
import time
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd
import schedule

# ── project imports ──────────────────────────────────────────────────
# Allow running as `python -m scheduler.cron_job` from the project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper.remoteok_scraper import RemoteOKScraper
from scraper.wwr_scraper import WWRscraper
from scraper.hackernews_scraper import HackerNewsScraper
from cleaning.clean_jobs import clean_jobs
from services.job_repository import upsert_jobs

# ── configuration ────────────────────────────────────────────────────
CSV_PATH = Path("cleaned_jobs.csv")
RAW_CSV_PATH = Path("all_scraped_jobs.csv")
INTERVAL_MINUTES = 15

# ── logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("cron_job")


# ── helpers ──────────────────────────────────────────────────────────

def _load_existing(path: Path) -> pd.DataFrame:
    """Load the existing cleaned CSV, or return an empty DataFrame."""
    if path.exists() and path.stat().st_size > 0:
        df = pd.read_csv(path)
        # Normalise the skills_extracted column back to lists
        if "skills_extracted" in df.columns:
            df["skills_extracted"] = df["skills_extracted"].apply(
                lambda v: ast.literal_eval(v) if isinstance(v, str) else v
            )
        return df
    return pd.DataFrame()


def _dedup_key(df: pd.DataFrame) -> pd.Series:
    """Create a composite dedup key from title + company."""
    return (
        df["title"].astype(str).str.strip().str.lower()
        + "|||"
        + df["company"].astype(str).str.strip().str.lower()
    )


def _scrape_all() -> list[dict]:
    """Run every registered scraper and return raw job dicts."""
    all_jobs: list[dict] = []
    scrapers = [
        RemoteOKScraper(),
        WWRscraper(),
        HackerNewsScraper(),
    ]
    for scraper in scrapers:
        name = scraper.__class__.__name__
        try:
            jobs = scraper.parse()
            all_jobs.extend(jobs)
            log.info("Scraped %d jobs from %s", len(jobs), name)
        except Exception as exc:
            log.error("Error scraping %s: %s", name, exc)
    return all_jobs


# ── main job ─────────────────────────────────────────────────────────

def fetch_and_save() -> None:
    """
    Single execution cycle:
      1. Scrape all sources
      2. Clean & normalise the new batch
      3. Load existing CSV
      4. Append only genuinely new jobs
      5. Save back to CSV
    """
    run_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log.info("── Scheduled run started at %s ──", run_ts)

    # 1. Scrape
    raw_jobs = _scrape_all()
    if not raw_jobs:
        log.warning("No jobs scraped this cycle. Skipping.")
        return

    df_new = pd.DataFrame(raw_jobs)
    log.info("Total scraped this cycle: %d", len(df_new))

    # Save raw snapshot (overwrite — it's just the latest batch)
    df_new.to_csv(RAW_CSV_PATH, index=False)

    # 2. Clean
    df_new_clean = clean_jobs(df_new)
    log.info("After cleaning: %d jobs", len(df_new_clean))

    # 2b. Upsert to Supabase (dedup handled by DB via unique link)
    try:
        jobs_list = df_new_clean.to_dict(orient="records")
        summary = upsert_jobs(jobs_list)
        log.info("DB upsert summary: %s", summary)
    except Exception as exc:
        log.error("DB upsert failed (continuing with CSV fallback): %s", exc)

    # 3. Load existing
    df_existing = _load_existing(CSV_PATH)

    if df_existing.empty:
        # First run — just save everything
        df_new_clean["scraped_at"] = run_ts
        df_new_clean.to_csv(CSV_PATH, index=False)
        log.info("First run — saved %d jobs to %s", len(df_new_clean), CSV_PATH)
        return

    # 4. Deduplicate: keep only jobs NOT already in the CSV
    existing_keys = set(_dedup_key(df_existing))
    new_keys = _dedup_key(df_new_clean)
    mask = ~new_keys.isin(existing_keys)
    df_truly_new = df_new_clean[mask].copy()

    if df_truly_new.empty:
        log.info("No new jobs this cycle — CSV unchanged.")
        return

    # 5. Append & save
    df_truly_new["scraped_at"] = run_ts
    df_combined = pd.concat([df_existing, df_truly_new], ignore_index=True)
    df_combined.to_csv(CSV_PATH, index=False)
    log.info(
        "Appended %d new job(s). Total in CSV: %d",
        len(df_truly_new),
        len(df_combined),
    )


# ── entry point ──────────────────────────────────────────────────────

def main() -> None:
    # --once flag: run a single cycle then exit (for system crontab use)
    if "--once" in sys.argv:
        log.info("Running once (--once flag detected).")
        fetch_and_save()
        return

    log.info(
        "Starting scheduler — will fetch jobs every %d minutes. Press Ctrl+C to stop.",
        INTERVAL_MINUTES,
    )

    # Run immediately on start, then every INTERVAL_MINUTES
    fetch_and_save()
    schedule.every(INTERVAL_MINUTES).minutes.do(fetch_and_save)

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Scheduler stopped by user.")


if __name__ == "__main__":
    main()
