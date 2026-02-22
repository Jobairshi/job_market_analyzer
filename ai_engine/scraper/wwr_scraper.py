# scraper/wwr_scraper.py
import requests
from bs4 import BeautifulSoup
import time

class WWRscraper:
    def __init__(self):
        self.url = "https://weworkremotely.com/categories/remote-programming-jobs.rss"
        self.headers = {"User-Agent": "Mozilla/5.0"}

    def parse(self):
        response = requests.get(self.url, headers=self.headers)
        # Parse as XML instead of HTML
        soup = BeautifulSoup(response.text, "xml")

        jobs = []

        items = soup.find_all("item")
        for item in items:
            title_tag = item.find("title")
            link_tag = item.find("link")
            company_tag = item.find("dc:creator")  # WWR RSS uses dc:creator for company

            if title_tag and link_tag:
                jobs.append({
                    "source": "WeWorkRemotely",
                    "title": title_tag.text.strip(),
                    "company": company_tag.text.strip() if company_tag else "Unknown",
                    "location": "Remote",
                    "skills": [],
                    "link": link_tag.text.strip()
                })
                time.sleep(0.05)

        return jobs