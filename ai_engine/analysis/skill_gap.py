# analysis/skill_gap.py
"""
Skill Gap Analysis — compare resume against a target job description
and return actionable improvement suggestions via OpenAI.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from shared import cache_get, cache_set, _make_key
from shared.token_logger import log_usage

log = logging.getLogger("skill_gap")

_SYSTEM = (
    "You are a career advisor. Compare the candidate's resume against the "
    "target job description. Identify missing skills and suggest a learning path.\n\n"
    "OUTPUT FORMAT (strict JSON, no markdown):\n"
    '{{"missing_skills":["skill1","skill2"],'
    '"learning_path":[{"skill":"...","resource":"...","type":"course|tool|certification"}],'
    '"summary":"..."}}'
)

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM),
    ("human",
     "RESUME (excerpt):\n{resume}\n\n"
     "TARGET JOB:\n{job_description}\n\n"
     "Analyze the skill gap."),
])


def analyze_skill_gap(
    resume_text: str,
    job_description: str,
) -> dict[str, Any]:

    # Truncate inputs for token efficiency
    resume_short = resume_text[:1500]
    job_short = job_description[:1500]

    cache_key = _make_key("skill_gap", resume_short[:300], job_short[:300])
    cached_val = cache_get(cache_key)
    if cached_val is not None:
        return cached_val

    # 🔥 Use OpenAI-compatible endpoint
    llm = ChatOpenAI(
        model="gpt-4o",
        api_key="3eNCIDa9JER314hP6B9kydsW6ZI8DwWDz7ssFtaCSXRWs9eq",  
        base_url="https://api.ai.cc/v1",
        temperature=0.3,
        max_tokens=600,
    )

    chain = _PROMPT | llm | JsonOutputParser()

    result = chain.invoke({
        "resume": resume_short,
        "job_description": job_short,
    })

    log_usage(
        prompt_tokens=len(resume_short.split()) + len(job_short.split()) + 50,
        completion_tokens=len(json.dumps(result).split()),
        endpoint="skill_gap",
    )

    cache_set(cache_key, result, ttl=300)
    log.info("Skill gap analysis complete.")
    return result