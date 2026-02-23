# resume/resume_service.py
"""
Resume → Vector Matching Engine.

Pipeline:
  1. Extract text from uploaded PDF via pdfplumber
  2. Generate a 384-dim embedding (same model as jobs)
  3. Query Supabase via pgvector cosine similarity
  4. Optionally boost score with skill overlap
  5. Return top-K matched jobs

No LLM. No RAG. Pure vector similarity.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np
import pdfplumber
from sentence_transformers import SentenceTransformer

from config.settings import settings
from db.supabase_client import get_client

log = logging.getLogger("resume_service")

# ── Model singleton (shares with embedding_service) ─────────────────

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        log.info("Loading embedding model '%s' …", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        log.info("Model loaded.")
    return _model


# ── Text extraction ─────────────────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> str:
    """Extract plain text from a PDF file using pdfplumber."""
    text_parts: list[str] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as exc:
        log.error("Failed to read PDF '%s': %s", file_path, exc)
        raise ValueError(f"Could not read PDF file: {exc}") from exc

    raw = "\n".join(text_parts)
    if not raw.strip():
        raise ValueError("Resume PDF appears to be empty or image-only.")

    # Clean whitespace
    cleaned = re.sub(r"\s+", " ", raw).strip()
    log.info("Extracted %d characters from resume.", len(cleaned))
    return cleaned


# ── Skill extraction (simple keyword matching) ──────────────────────

# Common tech skills to look for in the resume
_KNOWN_SKILLS = {
    "python", "javascript", "typescript", "react", "node", "nextjs", "nestjs",
    "java", "golang", "go", "rust", "c++", "c#", "ruby", "php", "swift",
    "kotlin", "scala", "r", "sql", "nosql", "mongodb", "postgresql", "mysql",
    "redis", "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
    "linux", "git", "ci/cd", "jenkins", "github actions",
    "machine learning", "deep learning", "nlp", "computer vision", "ai",
    "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy",
    "html", "css", "tailwind", "graphql", "rest", "api",
    "figma", "agile", "scrum", "devops", "data engineering",
    "spark", "hadoop", "kafka", "airflow", "dbt",
    "flask", "django", "fastapi", "express", "spring",
}


def _extract_skills(text: str) -> set[str]:
    """Extract known skills from resume text (case-insensitive)."""
    text_lower = text.lower()
    found = set()
    for skill in _KNOWN_SKILLS:
        # Word boundary check for short skills
        if len(skill) <= 2:
            if re.search(rf"\b{re.escape(skill)}\b", text_lower):
                found.add(skill)
        else:
            if skill in text_lower:
                found.add(skill)
    return found


# ── Skill overlap scoring ───────────────────────────────────────────

def _skill_overlap_score(resume_skills: set[str], job_tags: list[str]) -> float:
    """
    Fraction of resume skills found in job's cleaned_tags.
    Returns 0.0 – 1.0.
    """
    if not resume_skills:
        return 0.0
    job_set = {t.lower() for t in job_tags}
    overlap = resume_skills & job_set
    return len(overlap) / len(resume_skills)


# ── Main matching function ──────────────────────────────────────────

def process_resume_and_match(
    file_path: str,
    top_k: int = 10,
    use_skill_boost: bool = True,
) -> list[dict[str, Any]]:
    """
    Full pipeline: PDF → text → embedding → pgvector search → ranked results.

    Args:
        file_path:  Path to the uploaded PDF.
        top_k:      Number of top matches to return.
        use_skill_boost: If True, final score = 0.8*semantic + 0.2*skill_overlap.

    Returns:
        List of dicts with keys: title, company, location, link, similarity,
        skill_overlap, final_score, matched_skills.
    """
    # 1. Extract text
    log.info("Processing resume: %s", file_path)
    resume_text = extract_text_from_pdf(file_path)

    # 2. Extract skills from resume
    resume_skills = _extract_skills(resume_text)
    log.info("Detected %d skills in resume: %s", len(resume_skills), resume_skills)

    # 3. Generate embedding (same model as job embeddings)
    model = _get_model()
    vector: np.ndarray = model.encode(
        resume_text,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    embedding_list = vector.tolist()
    log.info("Resume embedding generated (dim=%d).", len(embedding_list))

    # 4. Query Supabase with pgvector cosine similarity
    client = get_client()

    # Use RPC for vector similarity search
    # Supabase JS-style: we'll use raw SQL via RPC or the PostgREST approach
    # The <=> operator gives cosine distance; similarity = 1 - distance
    try:
        response = client.rpc(
            "match_jobs_by_resume",
            {
                "query_embedding": embedding_list,
                "match_count": top_k * 2 if use_skill_boost else top_k,
            },
        ).execute()
        rows = response.data or []
    except Exception:
        # Fallback: fetch jobs with embeddings and compute similarity in Python
        log.warning("RPC function not found, falling back to client-side matching.")
        rows = _fallback_vector_search(embedding_list, top_k * 2 if use_skill_boost else top_k)

    log.info("Retrieved %d candidate matches from vector search.", len(rows))

    # 5. Score and rank
    results = []
    for row in rows:
        semantic_sim = float(row.get("similarity", 0))
        job_tags = row.get("cleaned_tags") or []

        if use_skill_boost:
            skill_score = _skill_overlap_score(resume_skills, job_tags)
            final_score = 0.8 * semantic_sim + 0.2 * skill_score
        else:
            skill_score = 0.0
            final_score = semantic_sim

        matched = list(resume_skills & {t.lower() for t in job_tags})

        results.append({
            "id": row.get("id"),
            "title": row.get("title", ""),
            "company": row.get("company", "Unknown"),
            "location": row.get("location", "Unknown"),
            "link": row.get("link", ""),
            "cleaned_tags": job_tags,
            "similarity": round(semantic_sim * 100, 1),
            "skill_overlap": round(skill_score * 100, 1),
            "final_score": round(final_score * 100, 1),
            "matched_skills": matched,
        })

    # Sort by final_score descending, take top_k
    results.sort(key=lambda r: r["final_score"], reverse=True)
    results = results[:top_k]

    log.info("Returning top %d matches (best score: %.1f%%).",
             len(results), results[0]["final_score"] if results else 0)
    return results


# ── Fallback: client-side cosine similarity ─────────────────────────

def _fallback_vector_search(
    query_embedding: list[float],
    limit: int,
) -> list[dict[str, Any]]:
    """
    Fetch all jobs with embeddings and compute cosine similarity locally.
    Used when the match_jobs_by_resume RPC function doesn't exist.
    """
    client = get_client()
    response = (
        client
        .table("jobs")
        .select("id, title, company, location, link, cleaned_tags, embedding")
        .not_.is_("embedding", "null")
        .execute()
    )

    rows = response.data or []
    if not rows:
        return []

    query_vec = np.array(query_embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return []
    query_vec = query_vec / query_norm

    scored = []
    for row in rows:
        emb = row.get("embedding")
        if not emb:
            continue
        job_vec = np.array(emb, dtype=np.float32)
        job_norm = np.linalg.norm(job_vec)
        if job_norm == 0:
            continue
        job_vec = job_vec / job_norm
        similarity = float(np.dot(query_vec, job_vec))
        scored.append({**row, "similarity": similarity})

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    # Remove embedding from results
    for s in scored:
        s.pop("embedding", None)
    return scored[:limit]
