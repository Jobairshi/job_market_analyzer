# ai_modules/skill_gap.py
"""
Enhanced Skill Gap AI — compares resume skills against real market demand.

1. Extract skills from resume via OpenAI structured output
2. Fetch top demanded skills from Supabase
3. Compute match_percentage & improvement_priority
4. Generate actionable learning roadmap via LLM
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from config.settings import settings
from db.supabase_client import get_client
from shared import cache_get, cache_set, _make_key
from shared.token_logger import log_usage

log = logging.getLogger("skill_gap_market")


# ── LLM config ───────────────────────────────────────────────────────

def _llm(max_tokens: int = 500) -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o",
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
        temperature=0.2,
        max_tokens=max_tokens,
    )


# ── Step 1: extract skills from resume ───────────────────────────────

_EXTRACT_SYSTEM = (
    "You are a skill extraction engine. Given a resume, extract all technical "
    "and professional skills mentioned. Return ONLY a JSON array of lowercase "
    "skill strings. No markdown, no explanation.\n"
    'Example: ["python","react","aws","sql","docker"]'
)

_EXTRACT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _EXTRACT_SYSTEM),
    ("human", "RESUME:\n{resume}\n\nExtract skills:"),
])


def extract_resume_skills(resume_text: str) -> list[str]:
    """Use LLM to extract skill list from resume text."""
    cache_key = _make_key("extract_skills", resume_text[:300])
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    chain = _EXTRACT_PROMPT | _llm(300) | JsonOutputParser()
    skills = chain.invoke({"resume": resume_text[:2000]})

    if isinstance(skills, list):
        skills = [s.lower().strip() for s in skills if isinstance(s, str)]
    else:
        skills = []

    log_usage(
        prompt_tokens=len(resume_text[:2000].split()) + 30,
        completion_tokens=len(skills) * 2,
        endpoint="extract_skills",
    )
    cache_set(cache_key, skills, ttl=600)
    return skills


# ── Step 2: fetch market demand from DB ──────────────────────────────

def fetch_top_demanded_skills(limit: int = 50) -> list[dict[str, Any]]:
    """
    Query Supabase for top demanded skills across all jobs.
    Returns [{"skill": "python", "demand": 142}, ...]
    """
    cache_key = _make_key("market_demand", str(limit))
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    sb = get_client()
    resp = sb.table("jobs").select("cleaned_tags").execute()
    rows = resp.data or []

    freq: dict[str, int] = {}
    for row in rows:
        for tag in row.get("cleaned_tags") or []:
            tag = tag.lower().strip()
            if tag:
                freq[tag] = freq.get(tag, 0) + 1

    ranked = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:limit]
    result = [{"skill": s, "demand": d} for s, d in ranked]

    cache_set(cache_key, result, ttl=600)
    return result


# ── Step 3: compare & score ──────────────────────────────────────────

def compute_gap(
    resume_skills: list[str],
    market_demand: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Compare resume skills vs market demand.
    Returns match_percentage, missing_skills (sorted by demand weight),
    matched_skills, and improvement_priority.
    """
    resume_set = set(s.lower() for s in resume_skills)
    market_skills = {d["skill"]: d["demand"] for d in market_demand}

    matched = [s for s in resume_skills if s in market_skills]
    missing = [
        {"skill": d["skill"], "demand": d["demand"]}
        for d in market_demand
        if d["skill"] not in resume_set
    ]

    total_market = len(market_demand)
    match_pct = round(len(matched) / max(total_market, 1) * 100, 1)

    return {
        "match_percentage": match_pct,
        "matched_skills": matched,
        "missing_skills": [m["skill"] for m in missing[:20]],
        "improvement_priority": missing[:10],  # top 10 by demand
    }


# ── Step 4: generate learning roadmap via LLM ───────────────────────

_ROADMAP_SYSTEM = (
    "You are a career coach. Given a list of missing skills sorted by market demand, "
    "create a concise upskilling roadmap.\n\n"
    "OUTPUT FORMAT (strict JSON, no markdown):\n"
    '{{"roadmap":['
    '{"skill":"...","priority":"high|medium|low","resource":"...","type":"course|tool|certification|project","est_weeks":N}'
    '],"summary":"..."}}'
)

_ROADMAP_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _ROADMAP_SYSTEM),
    ("human",
     "CANDIDATE SKILLS: {matched_skills}\n\n"
     "MISSING SKILLS (by market demand):\n{missing_skills}\n\n"
     "Create an upskilling roadmap."),
])


def generate_roadmap(
    matched_skills: list[str],
    missing_skills: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate AI-powered learning roadmap for missing skills."""
    missing_text = "\n".join(
        f"- {m['skill']} (demand: {m['demand']} jobs)"
        for m in missing_skills[:15]
    )

    cache_key = _make_key("roadmap", missing_text[:200])
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    chain = _ROADMAP_PROMPT | _llm(600) | JsonOutputParser()

    result = chain.invoke({
        "matched_skills": ", ".join(matched_skills[:20]),
        "missing_skills": missing_text,
    })

    log_usage(
        prompt_tokens=len(missing_text.split()) + 50,
        completion_tokens=len(json.dumps(result).split()),
        endpoint="roadmap",
    )

    cache_set(cache_key, result, ttl=3600)
    return result


# ── Public API ───────────────────────────────────────────────────────

def analyze_skill_gap_market(resume_text: str) -> dict[str, Any]:
    """
    Full pipeline: extract resume skills → fetch market demand →
    compute gap → generate roadmap.
    """
    cache_key = _make_key("skill_gap_market", resume_text[:300])
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # 1. Extract skills
    resume_skills = extract_resume_skills(resume_text)
    log.info("Extracted %d skills from resume", len(resume_skills))

    # 2. Market demand
    market = fetch_top_demanded_skills(50)
    log.info("Fetched %d market skills", len(market))

    # 3. Gap analysis
    gap = compute_gap(resume_skills, market)
    log.info("Match: %.1f%%, Missing: %d", gap["match_percentage"], len(gap["missing_skills"]))

    # 4. Roadmap (only if there are missing skills)
    roadmap = {}
    if gap["improvement_priority"]:
        try:
            roadmap = generate_roadmap(gap["matched_skills"], gap["improvement_priority"])
        except Exception as e:
            log.error("Roadmap generation failed: %s", e)
            roadmap = {"roadmap": [], "summary": "Roadmap generation failed."}

    result = {
        "match_percentage": gap["match_percentage"],
        "matched_skills": gap["matched_skills"],
        "missing_skills": gap["missing_skills"],
        "improvement_priority": gap["improvement_priority"],
        "roadmap": roadmap.get("roadmap", []),
        "summary": roadmap.get("summary", ""),
        "market_skills_analyzed": len(market),
    }

    cache_set(cache_key, result, ttl=3600)
    return result
