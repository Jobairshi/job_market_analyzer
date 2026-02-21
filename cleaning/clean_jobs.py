# cleaning/clean_jobs.py
"""
Main cleaning and normalization pipeline for scraped job data.

Expected input columns: source, title, company, location, skills, link
"""

import ast
import pandas as pd
from .utils import extract_skills


def _normalize_text(series: pd.Series) -> pd.Series:
    """Lowercase and strip whitespace from a string Series."""
    return series.astype(str).str.strip().str.lower()


def _parse_skills_field(value) -> list[str]:
    """
    Safely parse the raw 'skills' field, which may arrive as:
    - a Python list already
    - a stringified list  e.g. "['python', 'aws']"
    - a comma-separated string  e.g. "python, aws"
    - an empty string / NaN
    """
    if isinstance(value, list):
        return [s.strip().lower() for s in value if s]
    if not isinstance(value, str) or not value.strip():
        return []
    # Try to evaluate as a Python literal first
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, list):
            return [s.strip().lower() for s in parsed if s]
    except (ValueError, SyntaxError):
        pass
    # Fall back to comma split
    return [s.strip().lower() for s in value.split(",") if s.strip()]


def clean_jobs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and normalize a raw scraped-jobs DataFrame.

    Steps:
        1. Drop rows missing both title and link.
        2. Normalize text fields (lowercase + strip).
        3. Fill missing locations with 'remote'.
        4. Parse the skills field into a proper list.
        5. Extract skills from the job title and merge with the skills field.
        6. Deduplicate on (title, company).
        7. Reset the index.

    Args:
        df: Raw DataFrame with columns [source, title, company, location, skills, link].

    Returns:
        Cleaned and normalized DataFrame with an additional 'skills_extracted' column.
    """
    if df.empty:
        return df

    df = df.copy()

    # ------------------------------------------------------------------ #
    # 1. Drop rows that have no title AND no link — they are unusable
    # ------------------------------------------------------------------ #
    df.dropna(subset=["title", "link"], how="all", inplace=True)

    # ------------------------------------------------------------------ #
    # 2. Normalize text columns
    # ------------------------------------------------------------------ #
    for col in ["title", "company", "location", "source"]:
        if col in df.columns:
            df[col] = _normalize_text(df[col])

    # Normalize link: just strip whitespace (preserve case for URLs)
    df["link"] = df["link"].astype(str).str.strip()

    # ------------------------------------------------------------------ #
    # 3. Fill missing / blank locations
    # ------------------------------------------------------------------ #
    df["location"] = df["location"].replace({"": "remote", "nan": "remote"})
    df["location"].fillna("remote", inplace=True)

    # ------------------------------------------------------------------ #
    # 4. Parse the raw skills field into a clean list
    # ------------------------------------------------------------------ #
    df["skills"] = df["skills"].apply(_parse_skills_field)

    # ------------------------------------------------------------------ #
    # 5. Extract skills from title, then merge with the skills field
    # ------------------------------------------------------------------ #
    df["skills_from_title"] = df["title"].apply(extract_skills)

    def _merge_skills(row):
        combined = set(row["skills"]) | set(row["skills_from_title"])
        return sorted(combined)

    df["skills_extracted"] = df.apply(_merge_skills, axis=1)
    df.drop(columns=["skills_from_title"], inplace=True)

    # ------------------------------------------------------------------ #
    # 6. Deduplicate on (title, company)
    # ------------------------------------------------------------------ #
    before = len(df)
    df.drop_duplicates(subset=["title", "company"], keep="first", inplace=True)
    after = len(df)
    if before != after:
        print(f"Removed {before - after} duplicate job(s).")

    # ------------------------------------------------------------------ #
    # 7. Reset index
    # ------------------------------------------------------------------ #
    df.reset_index(drop=True, inplace=True)

    return df
