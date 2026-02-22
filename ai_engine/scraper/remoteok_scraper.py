# scraper/remoteok_scraper.py
import requests
import time

class RemoteOKScraper:
    def __init__(self):
        self.url = "https://remoteok.io/api"
        self.headers = {"User-Agent": "Mozilla/5.0"}

    def parse(self):
        response = requests.get(self.url, headers=self.headers)
        data = response.json()

        jobs = []
        for job in data[1:]:  # skip first element (metadata)
            try:
                jobs.append({
                    "source": "RemoteOK",
                    "title": job.get("position") or job.get("title"),
                    "company": job.get("company"),
                    "location": job.get("location") or "Remote",
                    "skills": job.get("tags", []),
                    "link": job.get("url")
                })
                time.sleep(0.05)
            except Exception:
                continue

        return jobs