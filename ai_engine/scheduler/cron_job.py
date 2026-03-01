# scheduler/cron_job.py
"""
Cron-style scheduler that fetches the latest jobs every 15 minutes.

Features:
  - Scrapes all sources (RemoteOK, WeWorkRemotely, HackerNews)
  - Cleans and normalizes new data
  - Upserts to Supabase (dedup handled by unique link constraint)
  - Generates embeddings for newly inserted rows

Usage:
    python -m scheduler.cron_job          # run the 15-min loop
    python -m scheduler.cron_job --once   # run once and exit (useful for system crontab)
"""

from __future__ import annotations

import sys
import time
import logging
from datetime import datetime

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
from embeddings.embedding_service import run_embedding_pipeline

# ── configuration ────────────────────────────────────────────────────
INTERVAL_MINUTES = 15

# ── logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("cron_job")


# ── helpers ──────────────────────────────────────────────────────────

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
      3. Upsert to Supabase (dedup handled by DB via unique link)
      4. Generate embeddings for new rows
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

    # 2. Clean
    df_new_clean = clean_jobs(df_new)
    log.info("After cleaning: %d jobs", len(df_new_clean))

    # 3. Upsert to Supabase (dedup handled by DB via unique link)
    try:
        jobs_list = df_new_clean.to_dict(orient="records")
        summary = upsert_jobs(jobs_list)
        log.info("DB upsert summary: %s", summary)
    except Exception as exc:
        log.error("DB upsert failed: %s", exc)

    # 4. Generate embeddings for any newly inserted rows
    try:
        emb_summary = run_embedding_pipeline()
        log.info("Embedding summary: %s", emb_summary)
    except Exception as exc:
        log.error("Embedding pipeline failed (continuing): %s", exc)


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

    # Run insights generation every hour
    def _generate_insights():
        try:
            from insights.generate_insights import generate_and_store_insights
            log.info("── Generating market insights ──")
            generate_and_store_insights()
            log.info("── Market insights generated ──")
        except Exception as exc:
            log.error("Insight generation failed: %s", exc)

    schedule.every(60).minutes.do(_generate_insights)

    try:
        while True:
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Scheduler stopped by user.")


if __name__ == "__main__":
    main()
