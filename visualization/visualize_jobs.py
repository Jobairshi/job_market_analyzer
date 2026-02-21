# visualization/visualize_jobs.py
"""
Visualization module for the AI Job Market Intelligence Platform.

Provides both static (matplotlib/seaborn) and interactive (Plotly) charts.

Usage:
    from visualization.visualize_jobs import run_all_visualizations
    import pandas as pd

    df = pd.read_csv("cleaned_jobs.csv")
    run_all_visualizations(df)
"""

from __future__ import annotations

import ast
import warnings
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import seaborn as sns
from plotly.subplots import make_subplots

# ------------------------------------------------------------------ #
# Configuration
# ------------------------------------------------------------------ #
OUTPUT_DIR = Path("visualization/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PALETTE = "viridis"
FIG_SIZE = (12, 6)
sns.set_theme(style="whitegrid", palette=PALETTE)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _parse_skills_column(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure 'skills_extracted' contains Python lists, not raw strings.
    Works whether the column holds lists or stringified lists.
    """
    df = df.copy()

    def _to_list(val):
        if isinstance(val, list):
            return val
        if not isinstance(val, str) or not val.strip():
            return []
        try:
            parsed = ast.literal_eval(val)
            if isinstance(parsed, list):
                return parsed
        except (ValueError, SyntaxError):
            pass
        return [s.strip() for s in val.split(",") if s.strip()]

    if "skills_extracted" in df.columns:
        df["skills_extracted"] = df["skills_extracted"].apply(_to_list)

    return df


def _guard_empty(df: pd.DataFrame, col: str, chart_name: str) -> bool:
    """Return True (and warn) when a required column is missing or all-empty."""
    if df.empty or col not in df.columns or df[col].dropna().empty:
        warnings.warn(f"[{chart_name}] No data available for column '{col}'. Skipping.")
        return True
    return False


def _save_static(fig: plt.Figure, filename: str) -> None:
    path = OUTPUT_DIR / filename
    fig.savefig(path, bbox_inches="tight", dpi=150)
    print(f"  Saved static chart → {path}")


def _save_interactive(fig, filename: str) -> None:
    path = OUTPUT_DIR / filename
    fig.write_html(str(path))
    print(f"  Saved interactive chart → {path}")


# ------------------------------------------------------------------ #
# 1. Jobs per source
# ------------------------------------------------------------------ #

def plot_jobs_per_source(df: pd.DataFrame) -> None:
    """
    Bar chart showing the number of job postings per source platform.

    Args:
        df: Cleaned jobs DataFrame.
    """
    if _guard_empty(df, "source", "plot_jobs_per_source"):
        return

    counts = df["source"].value_counts().reset_index()
    counts.columns = ["source", "count"]

    # --- Static ---
    fig, ax = plt.subplots(figsize=FIG_SIZE)
    sns.barplot(data=counts, x="source", y="count", hue="source", palette=PALETTE, legend=False, ax=ax)
    ax.set_title("Number of Jobs per Source", fontsize=16, fontweight="bold")
    ax.set_xlabel("Source", fontsize=13)
    ax.set_ylabel("Job Count", fontsize=13)
    ax.tick_params(axis="x", rotation=20)
    for bar in ax.patches:
        ax.annotate(
            f"{int(bar.get_height())}",
            (bar.get_x() + bar.get_width() / 2, bar.get_height()),
            ha="center", va="bottom", fontsize=11
        )
    plt.tight_layout()
    _save_static(fig, "jobs_per_source.png")
    plt.show()

    # --- Interactive ---
    fig_px = px.bar(
        counts, x="source", y="count",
        title="Number of Jobs per Source",
        labels={"source": "Source", "count": "Job Count"},
        color="count", color_continuous_scale=PALETTE,
        text="count"
    )
    fig_px.update_traces(textposition="outside")
    _save_interactive(fig_px, "jobs_per_source.html")


# ------------------------------------------------------------------ #
# 2. Top companies hiring
# ------------------------------------------------------------------ #

def plot_top_companies(df: pd.DataFrame, top_n: int = 10) -> None:
    """
    Horizontal bar chart of the top N companies by job posting count.

    Args:
        df:    Cleaned jobs DataFrame.
        top_n: How many companies to include (default 10).
    """
    if _guard_empty(df, "company", "plot_top_companies"):
        return

    counts = (
        df[df["company"].notna() & (df["company"] != "unknown")]
        ["company"]
        .value_counts()
        .head(top_n)
        .reset_index()
    )
    counts.columns = ["company", "count"]

    # --- Static ---
    fig, ax = plt.subplots(figsize=FIG_SIZE)
    sns.barplot(data=counts, y="company", x="count", hue="company", palette=PALETTE, legend=False, ax=ax)
    ax.set_title(f"Top {top_n} Companies Hiring", fontsize=16, fontweight="bold")
    ax.set_xlabel("Job Count", fontsize=13)
    ax.set_ylabel("Company", fontsize=13)
    for bar in ax.patches:
        ax.annotate(
            f"{int(bar.get_width())}",
            (bar.get_width(), bar.get_y() + bar.get_height() / 2),
            ha="left", va="center", fontsize=10, xytext=(4, 0),
            textcoords="offset points"
        )
    plt.tight_layout()
    _save_static(fig, "top_companies.png")
    plt.show()

    # --- Interactive ---
    fig_px = px.bar(
        counts, y="company", x="count", orientation="h",
        title=f"Top {top_n} Companies Hiring",
        labels={"company": "Company", "count": "Job Count"},
        color="count", color_continuous_scale=PALETTE,
        text="count"
    )
    fig_px.update_layout(yaxis={"categoryorder": "total ascending"})
    fig_px.update_traces(textposition="outside")
    _save_interactive(fig_px, "top_companies.html")


# ------------------------------------------------------------------ #
# 3. Top skills
# ------------------------------------------------------------------ #

def plot_top_skills(df: pd.DataFrame, top_n: int = 15) -> None:
    """
    Bar chart of the top N most frequently mentioned skills.

    Args:
        df:    Cleaned jobs DataFrame (skills_extracted column must be lists).
        top_n: How many skills to show (default 15).
    """
    df = _parse_skills_column(df)
    if _guard_empty(df, "skills_extracted", "plot_top_skills"):
        return

    all_skills = [
        skill
        for skills in df["skills_extracted"]
        for skill in skills
        if skill
    ]
    if not all_skills:
        warnings.warn("[plot_top_skills] skills_extracted column is empty. Skipping.")
        return

    counts = (
        pd.Series(all_skills)
        .value_counts()
        .head(top_n)
        .reset_index()
    )
    counts.columns = ["skill", "count"]

    # --- Static ---
    fig, ax = plt.subplots(figsize=FIG_SIZE)
    sns.barplot(data=counts, x="skill", y="count", hue="skill", palette=PALETTE, legend=False, ax=ax)
    ax.set_title(f"Top {top_n} Skills in Job Postings", fontsize=16, fontweight="bold")
    ax.set_xlabel("Skill", fontsize=13)
    ax.set_ylabel("Frequency", fontsize=13)
    ax.tick_params(axis="x", rotation=40)
    for bar in ax.patches:
        ax.annotate(
            f"{int(bar.get_height())}",
            (bar.get_x() + bar.get_width() / 2, bar.get_height()),
            ha="center", va="bottom", fontsize=10
        )
    plt.tight_layout()
    _save_static(fig, "top_skills.png")
    plt.show()

    # --- Interactive ---
    fig_px = px.bar(
        counts, x="skill", y="count",
        title=f"Top {top_n} Skills in Job Postings",
        labels={"skill": "Skill", "count": "Frequency"},
        color="count", color_continuous_scale=PALETTE,
        text="count"
    )
    fig_px.update_traces(textposition="outside")
    _save_interactive(fig_px, "top_skills.html")


# ------------------------------------------------------------------ #
# 4. Jobs per location
# ------------------------------------------------------------------ #

def plot_jobs_per_location(df: pd.DataFrame, top_n: int = 10) -> None:
    """
    Horizontal bar chart of the top N job locations.

    Args:
        df:    Cleaned jobs DataFrame.
        top_n: How many locations to include (default 10).
    """
    if _guard_empty(df, "location", "plot_jobs_per_location"):
        return

    counts = (
        df["location"]
        .value_counts()
        .head(top_n)
        .reset_index()
    )
    counts.columns = ["location", "count"]

    # --- Static ---
    fig, ax = plt.subplots(figsize=FIG_SIZE)
    sns.barplot(data=counts, y="location", x="count", hue="location", palette=PALETTE, legend=False, ax=ax)
    ax.set_title(f"Top {top_n} Job Locations", fontsize=16, fontweight="bold")
    ax.set_xlabel("Job Count", fontsize=13)
    ax.set_ylabel("Location", fontsize=13)
    for bar in ax.patches:
        ax.annotate(
            f"{int(bar.get_width())}",
            (bar.get_width(), bar.get_y() + bar.get_height() / 2),
            ha="left", va="center", fontsize=10, xytext=(4, 0),
            textcoords="offset points"
        )
    plt.tight_layout()
    _save_static(fig, "jobs_per_location.png")
    plt.show()

    # --- Interactive ---
    fig_px = px.bar(
        counts, y="location", x="count", orientation="h",
        title=f"Top {top_n} Job Locations",
        labels={"location": "Location", "count": "Job Count"},
        color="count", color_continuous_scale=PALETTE,
        text="count"
    )
    fig_px.update_layout(yaxis={"categoryorder": "total ascending"})
    fig_px.update_traces(textposition="outside")
    _save_interactive(fig_px, "jobs_per_location.html")


# ------------------------------------------------------------------ #
# 5. Interactive Plotly dashboard (all-in-one)
# ------------------------------------------------------------------ #

def build_dashboard(df: pd.DataFrame, top_n: int = 10) -> None:
    """
    Build and save a single-file Plotly dashboard with four subplots:
    Jobs per source, top companies, top skills, and top locations.

    Args:
        df:    Cleaned jobs DataFrame.
        top_n: N used for companies, skills, and locations panels.
    """
    df = _parse_skills_column(df)

    def _counts(col, n=top_n, exclude=None):
        s = df[col].dropna()
        if exclude:
            s = s[~s.isin(exclude)]
        return s.value_counts().head(n).reset_index().set_axis([col, "count"], axis=1)

    # Skills need exploding
    all_skills = [sk for skills in df.get("skills_extracted", pd.Series(dtype=object)) for sk in skills if sk]
    skill_counts = (
        pd.Series(all_skills).value_counts().head(top_n).reset_index()
        .set_axis(["skill", "count"], axis=1)
    ) if all_skills else pd.DataFrame(columns=["skill", "count"])

    source_c   = _counts("source", n=20)
    company_c  = _counts("company", exclude=["unknown"])
    location_c = _counts("location")

    fig = make_subplots(
        rows=2, cols=2,
        subplot_titles=[
            "Jobs per Source",
            f"Top {top_n} Companies",
            f"Top {top_n} Skills",
            f"Top {top_n} Locations",
        ]
    )

    def _bar(x, y, row, col):
        fig.add_trace(go.Bar(x=x, y=y, marker_color="#636efa"), row=row, col=col)

    _bar(source_c["source"],         source_c["count"],         1, 1)
    _bar(company_c["company"],       company_c["count"],        1, 2)
    _bar(skill_counts["skill"],      skill_counts["count"],     2, 1)
    _bar(location_c["location"],     location_c["count"],       2, 2)

    fig.update_layout(
        title_text="AI Job Market Intelligence — Dashboard",
        title_font_size=20,
        showlegend=False,
        height=800,
    )
    fig.update_xaxes(tickangle=35)

    _save_interactive(fig, "dashboard.html")


# ------------------------------------------------------------------ #
# 6. run_all_visualizations — entry point
# ------------------------------------------------------------------ #

def run_all_visualizations(df: pd.DataFrame) -> None:
    """
    Run every visualization in sequence and save outputs to
    visualization/output/.

    Args:
        df: Cleaned jobs DataFrame (as returned by clean_jobs or read from CSV).
    """
    if df.empty:
        print("DataFrame is empty — nothing to visualize.")
        return

    print("\n── Generating visualizations ──────────────────────────────")
    print("1/5  Jobs per source …")
    plot_jobs_per_source(df)

    print("2/5  Top companies …")
    plot_top_companies(df)

    print("3/5  Top skills …")
    plot_top_skills(df)

    print("4/5  Jobs per location …")
    plot_jobs_per_location(df)

    print("5/5  Building interactive dashboard …")
    build_dashboard(df)

    print(f"\nAll outputs saved to: {OUTPUT_DIR.resolve()}/")
    print("────────────────────────────────────────────────────────────\n")
