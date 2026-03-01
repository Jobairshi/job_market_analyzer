import sys
import logging
import pandas as pd
from scraper.remoteok_scraper import RemoteOKScraper
from scraper.wwr_scraper import WWRscraper
from scraper.hackernews_scraper import HackerNewsScraper
from cleaning.clean_jobs import clean_jobs
from visualization.visualize_jobs import run_all_visualizations
from services.job_repository import upsert_jobs
from embeddings.embedding_service import run_embedding_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("main")


def run_all_scrapers():
    all_jobs = []

    scrapers = [
        RemoteOKScraper(),
        WWRscraper(),
        HackerNewsScraper()
    ]

    for scraper in scrapers:
        try:
            jobs = scraper.parse()
            all_jobs.extend(jobs)
            print(f"Scraped {len(jobs)} jobs from {scraper.__class__.__name__}")
        except Exception as e:
            print(f"Error scraping {scraper.__class__.__name__}: {e}")

    return all_jobs


if __name__ == "__main__":
    # --- Scrape ---
    jobs = run_all_scrapers()
    print(f"\nTotal Jobs Collected: {len(jobs)}")

    # --- Clean & normalize ---
    df_raw = pd.DataFrame(jobs)
    df_clean = clean_jobs(df_raw)
    print(f"Total Jobs After Cleaning: {len(df_clean)}")
    print(df_clean[["source", "title", "company", "location", "skills_extracted"]].head(10))

    # --- Store in Supabase ---
    try:
        jobs_list = df_clean.to_dict(orient="records")
        summary = upsert_jobs(jobs_list)
        log.info("DB upsert summary: %s", summary)
    except Exception as e:
        log.error("DB upsert failed (continuing without DB): %s", e)

    # --- Generate & store embeddings ---
    try:
        emb_summary = run_embedding_pipeline()
        print(
            f"\nEmbedding summary:"
            f"  Fetched {emb_summary['fetched']} jobs | "
            f"Generated {emb_summary['generated']} embeddings | "
            f"Stored {emb_summary['stored']}"
        )
    except Exception as e:
        log.error("Embedding pipeline failed (continuing): %s", e)

    # --- Visualize ---
    run_all_visualizations(df_clean)

    # --- Start scheduler (optional) ---
    if "--schedule" in sys.argv:
        from scheduler.cron_job import main as run_scheduler
        run_scheduler()