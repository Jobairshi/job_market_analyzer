import requests
from bs4 import BeautifulSoup
from abc import ABC, abstractmethod

class BaseScraper(ABC):
    def __init__(self, url):
        self.url = url
        self.headers = {
            "User-Agent": "Mozilla/5.0"
        }

    def fetch(self):
        response = requests.get(self.url, headers=self.headers, timeout=10)
        response.raise_for_status()
        return response.text

    def get_soup(self):
        html = self.fetch()
        return BeautifulSoup(html, "html.parser")

    @abstractmethod
    def parse(self):
        pass