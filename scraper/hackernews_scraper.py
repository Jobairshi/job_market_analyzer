# scraper/hackernews_scraper.py
import requests
import time

class HackerNewsScraper:
    def __init__(self):
        # “Who is hiring” story IDs
        self.url = "https://hacker-news.firebaseio.com/v0/jobstories.json"

    def parse(self):
        response = requests.get(self.url)
        job_ids = response.json()[:30]  # limit to 30 jobs for now

        jobs = []

        for job_id in job_ids:
            job_url = f"https://hacker-news.firebaseio.com/v0/item/{job_id}.json"
            job_resp = requests.get(job_url)
            job_data = job_resp.json()

            if job_data:
                jobs.append({
                    "source": "HackerNews",
                    "title": job_data.get("title"),
                    "company": "Unknown",
                    "location": "Unknown",
                    "skills": [],
                    "link": job_data.get("url") or f"https://news.ycombinator.com/item?id={job_id}"
                })
                time.sleep(0.05)

        return jobs