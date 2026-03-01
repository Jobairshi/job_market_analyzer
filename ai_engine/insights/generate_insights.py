# insights/generate_insights.py
"""
Automated Market Intelligence Engine.

Runs hourly (called by cron_job.py or standalone).
Compares 24h vs 7d skill demand, detects trends, generates
natural-language insights via OpenAI, and stores them in Supabase.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from config.settings import settings
from db.supabase_client import get_client
from shared import cache_get, cache_set, _make_key
from shared.token_logger import log_usage

log = logging.getLogger("insights")


# ── LLM ──────────────────────────────────────────────────────────────

def _llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=0.4,
        max_tokens=800,
    )


# ── Data collection ──────────────────────────────────────────────────

def _skill_freq(rows: list[dict]) -> dict[str, int]:
    freq: dict[str, int] = {}
    for r in rows:
        for tag in r.get("cleaned_tags") or []:
            tag = tag.lower().strip()
            if tag:
                freq[tag] = freq.get(tag, 0) + 1
    return freq


def _location_freq(rows: list[dict]) -> dict[str, int]:
    freq: dict[str, int] = {}
    for r in rows:
        loc = (r.get("location") or "").strip()
        if loc:
            freq[loc] = freq.get(loc, 0) + 1
    return freq


def _fetch_jobs_since(hours: int) -> list[dict]:
    """Fetch jobs scraped within last N hours."""
    sb = get_client()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    resp = (
        sb.table("jobs")
        .select("title, company, location, cleaned_tags, scraped_at")
        .gte("scraped_at", cutoff)
        .execute()
    )
    return resp.data or []


# ── Trend detection ──────────────────────────────────────────────────

def detect_trends() -> dict[str, Any]:
    """
    Compare 24h demand vs 7d average to detect:
      - Trending skills (growth > 20%)
      - Declining skills
      - Hiring surges by location
    """
    jobs_24h = _fetch_jobs_since(24)
    jobs_7d = _fetch_jobs_since(168)  # 7 * 24

    skills_24h = _skill_freq(jobs_24h)
    skills_7d = _skill_freq(jobs_7d)

    locations_24h = _location_freq(jobs_24h)
    locations_7d = _location_freq(jobs_7d)

    # Normalize 7d to daily average
    days = 7
    trending_skills = []
    declining_skills = []

    for skill, count_24h in skills_24h.items():
        avg_7d = skills_7d.get(skill, 0) / days
        if avg_7d > 0:
            growth = (count_24h - avg_7d) / avg_7d * 100
        elif count_24h > 0:
            growth = 100.0
        else:
            continue

        entry = {"skill": skill, "count_24h": count_24h, "avg_7d": round(avg_7d, 1), "growth_pct": round(growth, 1)}

        if growth >= 20 and count_24h >= 2:
            trending_skills.append(entry)
        elif growth <= -30 and avg_7d >= 2:
            declining_skills.append(entry)

    trending_skills.sort(key=lambda x: x["growth_pct"], reverse=True)
    declining_skills.sort(key=lambda x: x["growth_pct"])

    # Location surges
    location_surges = []
    for loc, count_24h in locations_24h.items():
        avg_7d = locations_7d.get(loc, 0) / days
        if avg_7d > 0:
            growth = (count_24h - avg_7d) / avg_7d * 100
        elif count_24h >= 2:
            growth = 100.0
        else:
            continue

        if growth >= 25 and count_24h >= 2:
            location_surges.append({
                "location": loc,
                "count_24h": count_24h,
                "avg_7d": round(avg_7d, 1),
                "growth_pct": round(growth, 1),
            })

    location_surges.sort(key=lambda x: x["growth_pct"], reverse=True)

    return {
        "jobs_24h": len(jobs_24h),
        "jobs_7d": len(jobs_7d),
        "trending_skills": trending_skills[:10],
        "declining_skills": declining_skills[:5],
        "location_surges": location_surges[:10],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Insight text generation ──────────────────────────────────────────

_INSIGHT_SYSTEM = (
    "You are a job market analyst. Given trend data, generate 3-5 concise, "
    "actionable market insights. Each insight should be one clear sentence.\n\n"
    "OUTPUT FORMAT (strict JSON, no markdown):\n"
    '{{"insights":['
    '{"title":"short title","text":"insight text","type":"trending|declining|surge|general","severity":"high|medium|low"}'
    '],"market_summary":"one paragraph overview"}}'
)

_INSIGHT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _INSIGHT_SYSTEM),
    ("human",
     "MARKET DATA (last 24h vs 7d average):\n\n"
     "Jobs in last 24h: {jobs_24h}\n"
     "Jobs in last 7d: {jobs_7d}\n\n"
     "TRENDING SKILLS:\n{trending}\n\n"
     "DECLINING SKILLS:\n{declining}\n\n"
     "LOCATION SURGES:\n{surges}\n\n"
     "Generate market insights."),
])


def generate_insight_text(trends: dict[str, Any]) -> dict[str, Any]:
    """Use LLM to generate natural-language insights from trend data."""
    cache_key = _make_key("insight_gen", trends["timestamp"][:13])  # cache per hour
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    trending_text = "\n".join(
        f"- {t['skill']}: +{t['growth_pct']}% ({t['count_24h']} in 24h)"
        for t in trends["trending_skills"][:8]
    ) or "No significant trending skills."

    declining_text = "\n".join(
        f"- {t['skill']}: {t['growth_pct']}% ({t['count_24h']} in 24h)"
        for t in trends["declining_skills"][:5]
    ) or "No significant declining skills."

    surges_text = "\n".join(
        f"- {s['location']}: +{s['growth_pct']}% ({s['count_24h']} in 24h)"
        for s in trends["location_surges"][:8]
    ) or "No significant location surges."

    chain = _INSIGHT_PROMPT | _llm() | JsonOutputParser()

    result = chain.invoke({
        "jobs_24h": trends["jobs_24h"],
        "jobs_7d": trends["jobs_7d"],
        "trending": trending_text,
        "declining": declining_text,
        "surges": surges_text,
    })

    log_usage(
        prompt_tokens=len(trending_text.split()) + len(declining_text.split()) + 60,
        completion_tokens=len(json.dumps(result).split()),
        endpoint="insights",
    )

    cache_set(cache_key, result, ttl=3600)
    return result


# ── Store to DB ──────────────────────────────────────────────────────

def store_insights(trends: dict[str, Any], insights: dict[str, Any]) -> None:
    """Persist insights to Supabase market_insights table."""
    sb = get_client()

    records = []
    for item in insights.get("insights", []):
        records.append({
            "title": item.get("title", ""),
            "text": item.get("text", ""),
            "insight_type": item.get("type", "general"),
            "severity": item.get("severity", "medium"),
            "market_summary": insights.get("market_summary", ""),
            "raw_trends": json.dumps({
                "jobs_24h": trends["jobs_24h"],
                "jobs_7d": trends["jobs_7d"],
                "trending_skills": trends["trending_skills"][:5],
                "location_surges": trends["location_surges"][:5],
            }),
        })

    if records:
        try:
            sb.table("market_insights").insert(records).execute()
            log.info("Stored %d insights to DB", len(records))
        except Exception as e:
            log.error("Failed to store insights: %s", e)


# ── Public: full pipeline ────────────────────────────────────────────

def generate_and_store_insights() -> dict[str, Any]:
    """
    Full pipeline: detect trends → generate text → store.
    Called by cron every hour.
    """
    log.info("Generating market insights...")

    trends = detect_trends()
    log.info(
        "Trends: %d trending, %d declining, %d surges",
        len(trends["trending_skills"]),
        len(trends["declining_skills"]),
        len(trends["location_surges"]),
    )

    # Only call LLM if there's something notable
    if (trends["trending_skills"] or trends["declining_skills"]
            or trends["location_surges"]):
        insights = generate_insight_text(trends)
        store_insights(trends, insights)
    else:
        insights = {
            "insights": [{
                "title": "Market Stable",
                "text": "No significant changes in job market trends in the last 24 hours.",
                "type": "general",
                "severity": "low",
            }],
            "market_summary": "The job market is stable with no notable trend changes.",
        }
        store_insights(trends, insights)

    return {**trends, **insights}


def get_latest_insights(limit: int = 10) -> list[dict[str, Any]]:
    """Fetch latest insights from DB."""
    cache_key = _make_key("latest_insights", str(limit))
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    sb = get_client()
    resp = (
        sb.table("market_insights")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    result = resp.data or []
    cache_set(cache_key, result, ttl=300)
    return result
