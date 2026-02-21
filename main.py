import sys
import pandas as pd
from scraper.remoteok_scraper import RemoteOKScraper
from scraper.wwr_scraper import WWRscraper
from scraper.hackernews_scraper import HackerNewsScraper
from cleaning.clean_jobs import clean_jobs
from cleaning.utils import save_to_csv
from visualization.visualize_jobs import run_all_visualizations


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

    # --- Raw save ---
    df_raw = pd.DataFrame(jobs)
    df_raw.to_csv("all_scraped_jobs.csv", index=False)

    # --- Clean & normalize ---
    df_clean = clean_jobs(df_raw)
    print(f"Total Jobs After Cleaning: {len(df_clean)}")
    print(df_clean[["source", "title", "company", "location", "skills_extracted"]].head(10))

    # --- Save cleaned output ---
    save_to_csv(df_clean, "cleaned_jobs.csv")

    # --- Visualize ---
    run_all_visualizations(df_clean)

    # --- Start scheduler (optional) ---
    if "--schedule" in sys.argv:
        from scheduler.cron_job import main as run_scheduler
        run_scheduler()