# intelligence/match_explainer.py
"""
Resume-Aware Matching with AI Explanation.

After vector search retrieves top matches, uses OpenAI to explain
*why* each job is a good match and what skills are missing.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import AzureChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from config.settings import settings
from shared import cache_get, cache_set, _make_key
from shared.token_logger import log_usage

log = logging.getLogger("match_explainer")

_SYSTEM = (
    "You are a job matching expert. Given a resume excerpt and a job listing, "
    "explain the match quality concisely.\n\n"
    "OUTPUT FORMAT (strict JSON, no markdown):\n"
    '{{"job_title":"...","match_score":<0-1 float>,"why_match":"...","missing_skills":["..."],"improvement_suggestions":["..."]}}'
)

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM),
    ("human",
     "RESUME (excerpt):\n{resume}\n\n"
     "JOB: {title} @ {company}\n"
     "Location: {location}\n"
     "Skills: {tags}\n"
     "Description: {description}\n\n"
     "Explain the match."),
])


def explain_match(
    resume_text: str,
    job: dict[str, Any],
) -> dict[str, Any]:
    """Generate AI explanation for a single resume-job match."""
    if not settings.azure_openai_api_key:
        raise ValueError("AZURE_OPENAI_API_KEY is not configured.")

    title = job.get("title", "")
    company = job.get("company", "Unknown")

    cache_key = _make_key("explain", resume_text[:200], title, company)
    cached_val = cache_get(cache_key)
    if cached_val is not None:
        return cached_val

    llm = AzureChatOpenAI(
        azure_deployment=settings.azure_deployment_name,
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.azure_openai_api_version,
        temperature=0.3,
        max_tokens=400,
    )
    chain = _PROMPT | llm | JsonOutputParser()

    desc = (job.get("description") or "")[:800]
    tags = ", ".join(job.get("cleaned_tags") or [])

    result = chain.invoke({
        "resume": resume_text[:1000],
        "title": title,
        "company": company,
        "location": job.get("location", "Unknown"),
        "tags": tags,
        "description": desc,
    })

    log_usage(
        prompt_tokens=len(resume_text[:1000].split()) + len(desc.split()) + 60,
        completion_tokens=len(json.dumps(result).split()),
        endpoint="match_explain",
    )

    cache_set(cache_key, result, ttl=300)
    return result


def explain_top_matches(
    resume_text: str,
    matched_jobs: list[dict[str, Any]],
    max_explain: int = 5,
) -> list[dict[str, Any]]:
    """
    Add AI explanations to the top N matched jobs.
    Only explains top `max_explain` to control cost.
    """
    explained = []
    for job in matched_jobs[:max_explain]:
        try:
            explanation = explain_match(resume_text, job)
            explained.append({**job, "explanation": explanation})
        except Exception as exc:
            log.error("Failed to explain match for '%s': %s", job.get("title"), exc)
            explained.append({**job, "explanation": None})

    # Append remaining jobs without explanation
    for job in matched_jobs[max_explain:]:
        explained.append({**job, "explanation": None})

    return explained
