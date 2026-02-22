# cleaning/utils.py
"""
Utility functions for the cleaning module.
Includes skill extraction and CSV saving helpers.
"""

import re
import pandas as pd
from pathlib import Path

# Skills to detect — extend this list as needed
SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "django", "flask", "fastapi", "node", "nodejs", "express",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
    "sql", "postgresql", "mysql", "mongodb", "redis",
    "ai", "ml", "machine learning", "deep learning", "nlp",
    "c++", "c#", "golang", "go", "rust", "scala", "kotlin", "swift",
    "git", "linux", "ci/cd", "graphql", "rest", "api"
]


def extract_skills(text: str) -> list[str]:
    """
    Extract known skill keywords from a text string.

    Args:
        text: A string (e.g. job title or skills field).

    Returns:
        A sorted list of unique detected skill strings.
    """
    if not isinstance(text, str):
        return []

    text_lower = text.lower()
    found = set()

    for skill in SKILL_KEYWORDS:
        # Use word-boundary matching to avoid partial matches (e.g. "go" in "golang")
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.add(skill)

    return sorted(found)


def save_to_csv(df: pd.DataFrame, filename: str = "cleaned_jobs.csv") -> None:
    """
    Save a DataFrame to a CSV file.

    Args:
        df:       The DataFrame to save.
        filename: Output file path (default: cleaned_jobs.csv).
    """
    output_path = Path(filename)
    df.to_csv(output_path, index=False)
    print(f"Saved {len(df)} jobs to '{output_path.resolve()}'")


def save_to_json(df: pd.DataFrame, filename: str = "cleaned_jobs.json") -> None:
    """
    Save a DataFrame to a JSON file (records orientation).

    Args:
        df:       The DataFrame to save.
        filename: Output file path (default: cleaned_jobs.json).
    """
    output_path = Path(filename)
    df.to_json(output_path, orient="records", indent=2)
    print(f"Saved {len(df)} jobs to '{output_path.resolve()}'")
