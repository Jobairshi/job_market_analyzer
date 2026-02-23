# recommendation/recommendation_service.py
"""
Personalized Job Recommendation System.

Builds a user profile embedding from preferences + resume text,
then performs pgvector search with multi-factor re-ranking.

Scoring:
  final_score = 0.6 * semantic_similarity
              + 0.2 * skill_overlap
              + 0.2 * preference_match
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer

from config.settings import settings
from db.supabase_client import get_client
from shared import cache_get, cache_set, _make_key

log = logging.getLogger("recommendation_service")

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embedding_model)
    return _model


# ── Known skills for overlap scoring ────────────────────────────────

_KNOWN_SKILLS = {
    "python", "javascript", "typescript", "react", "node", "nextjs", "nestjs",
    "java", "golang", "go", "rust", "c++", "c#", "ruby", "php", "swift",
    "kotlin", "scala", "sql", "nosql", "mongodb", "postgresql", "mysql",
    "redis", "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
    "linux", "git", "machine learning", "deep learning", "nlp", "ai",
    "tensorflow", "pytorch", "pandas", "numpy", "html", "css", "tailwind",
    "graphql", "rest", "api", "flask", "django", "fastapi", "express", "spring",
    "spark", "kafka", "airflow", "devops", "data engineering", "figma",
}


def _extract_skills(text: str) -> set[str]:
    text_lower = text.lower()
    found = set()
    for skill in _KNOWN_SKILLS:
        if len(skill) <= 2:
            if re.search(rf"\b{re.escape(skill)}\b", text_lower):
                found.add(skill)
        elif skill in text_lower:
            found.add(skill)
    return found


def _skill_overlap(user_skills: set[str], job_tags: list[str]) -> float:
    if not user_skills:
        return 0.0
    job_set = {t.lower() for t in job_tags}
    return len(user_skills & job_set) / len(user_skills)


def _preference_match(job: dict, pref_location: str, pref_skills: list[str]) -> float:
    score = 0.0
    # Location match
    if pref_location:
        jloc = (job.get("location") or "").lower()
        if pref_location.lower() in jloc or "remote" in jloc:
            score += 0.5
    # Skill preference match
    if pref_skills:
        job_tags = {t.lower() for t in (job.get("cleaned_tags") or [])}
        pref_set = {s.lower() for s in pref_skills}
        overlap = len(pref_set & job_tags)
        score += 0.5 * (overlap / len(pref_set)) if pref_set else 0
    return min(score, 1.0)


def _vector_search(embedding: list[float], limit: int = 50) -> list[dict]:
    client = get_client()
    try:
        resp = client.rpc(
            "match_jobs_by_resume",
            {"query_embedding": embedding, "match_count": limit},
        ).execute()
        return resp.data or []
    except Exception:
        log.warning("RPC fallback for recommendation search.")
        resp = (
            client.table("jobs")
            .select("id,title,company,location,link,cleaned_tags,embedding")
            .not_.is_("embedding", "null")
            .limit(500)
            .execute()
        )
        rows = resp.data or []
        qv = np.array(embedding, dtype=np.float32)
        qv = qv / (np.linalg.norm(qv) + 1e-9)
        for r in rows:
            emb = r.get("embedding")
            if emb:
                jv = np.array(emb, dtype=np.float32)
                jv = jv / (np.linalg.norm(jv) + 1e-9)
                r["similarity"] = float(np.dot(qv, jv))
            else:
                r["similarity"] = 0.0
            r.pop("embedding", None)
        rows.sort(key=lambda x: x["similarity"], reverse=True)
        return rows[:limit]


def get_recommendations(
    resume_text: str = "",
    preferred_skills: list[str] | None = None,
    preferred_location: str = "",
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """
    Generate personalized job recommendations.

    Args:
        resume_text: Raw text from user's resume.
        preferred_skills: User-specified skill preferences.
        preferred_location: Preferred work location.
        top_k: Number of recommendations to return.

    Returns:
        List of dicts with job info + scores.
    """
    pref_skills = preferred_skills or []

    # Cache key from inputs
    cache_key = _make_key("recommend", resume_text[:200], pref_skills, preferred_location)
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    # Build query text combining resume + preferences
    parts = []
    if resume_text:
        # Truncate resume to ~500 chars for embedding (token efficiency)
        parts.append(resume_text[:500])
    if pref_skills:
        parts.append("Skills: " + ", ".join(pref_skills))
    if preferred_location:
        parts.append("Location: " + preferred_location)

    query_text = " ".join(parts) if parts else "software engineer"

    # Embed combined profile
    model = _get_model()
    vec = model.encode(query_text, convert_to_numpy=True, normalize_embeddings=True)

    # Extract skills from resume for overlap scoring
    user_skills = _extract_skills(resume_text) if resume_text else set()
    user_skills |= {s.lower() for s in pref_skills}

    # Vector search
    candidates = _vector_search(vec.tolist(), limit=top_k * 5)

    # Multi-factor re-ranking
    results = []
    for job in candidates:
        semantic = float(job.get("similarity", 0))
        skill_ov = _skill_overlap(user_skills, job.get("cleaned_tags") or [])
        pref_m = _preference_match(job, preferred_location, pref_skills)

        final = 0.6 * semantic + 0.2 * skill_ov + 0.2 * pref_m

        results.append({
            "id": job.get("id"),
            "title": job.get("title", ""),
            "company": job.get("company", "Unknown"),
            "location": job.get("location", "Unknown"),
            "link": job.get("link", ""),
            "cleaned_tags": job.get("cleaned_tags") or [],
            "semantic_similarity": round(semantic * 100, 1),
            "skill_overlap": round(skill_ov * 100, 1),
            "preference_match": round(pref_m * 100, 1),
            "final_score": round(final * 100, 1),
            "matched_skills": list(user_skills & {t.lower() for t in (job.get("cleaned_tags") or [])}),
        })

    results.sort(key=lambda r: r["final_score"], reverse=True)
    results = results[:top_k]

    cache_set(cache_key, results, ttl=300)
    log.info("Generated %d recommendations.", len(results))
    return results
