# intelligence/rag_service.py
"""
RAG-based Job Intelligence — answer analytical questions about the job market.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import numpy as np
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from sentence_transformers import SentenceTransformer

from config.settings import settings
from db.supabase_client import get_client
from shared import cache_get, cache_set, _make_key
from shared.token_logger import log_usage

log = logging.getLogger("rag_service")

# ── Embedding model (singleton) ───────────────────────────────────────

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.embedding_model)
    return _model


# ── Prompt ────────────────────────────────────────────────────────────

_SYSTEM = (
    "You are a job market analyst. Given job listings data, answer the user's "
    "question with a structured JSON object. Be concise and data-driven.\n\n"
    "OUTPUT FORMAT (strict JSON, no markdown):\n"
    '{{"summary":"...",'
    '"top_skills":["skill1","skill2"],'
    '"top_companies":["c1","c2"],'
    '"insight":"..."}}'
)

_PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM),
    ("human", "JOB DATA:\n{context}\n\nQUESTION: {query}"),
])


# ── LLM Factory ───────────────────────────────────────────────────────

def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o",
         api_key="3eNCIDa9JER314hP6B9kydsW6ZI8DwWDz7ssFtaCSXRWs9eq",  
        base_url="https://api.ai.cc/v1",
        temperature=0.3,
        max_tokens=500,
    )


# ── Context Builder ───────────────────────────────────────────────────

def _build_context(rows: list[dict]) -> str:
    lines: list[str] = []
    for r in rows:
        tags = ", ".join(r.get("cleaned_tags") or [])
        lines.append(
            f"- {r.get('title','')} @ {r.get('company','?')} | "
            f"{r.get('location','?')} | skills: {tags}"
        )
    return "\n".join(lines)


# ── Vector Search ─────────────────────────────────────────────────────

def _vector_search(query_embedding: list[float], limit: int = 20) -> list[dict]:
    client = get_client()

    try:
        resp = client.rpc(
            "match_jobs_by_resume",
            {"query_embedding": query_embedding, "match_count": limit},
        ).execute()
        return resp.data or []

    except Exception:
        log.warning("RPC not available, using client-side search.")

        resp = (
            client.table("jobs")
            .select("id,title,company,location,cleaned_tags,description,embedding")
            .not_.is_("embedding", "null")
            .limit(500)
            .execute()
        )

        rows = resp.data or []
        qv = np.array(query_embedding, dtype=np.float32)
        qv = qv / (np.linalg.norm(qv) + 1e-9)

        scored = []
        for r in rows:
            emb = r.get("embedding")
            if not emb:
                continue

            jv = np.array(emb, dtype=np.float32)
            jv = jv / (np.linalg.norm(jv) + 1e-9)

            r["similarity"] = float(np.dot(qv, jv))
            r.pop("embedding", None)
            scored.append(r)

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:limit]


# ── Main RAG Entry ────────────────────────────────────────────────────

def query_intelligence(query: str) -> dict[str, Any]:
    """
    Answer an analytical question about the job market using RAG.
    """



    cache_key = _make_key("rag", query.lower().strip())
    cached = cache_get(cache_key)
    if cached is not None:
        log.info("Cache hit for query: %s", query[:60])
        return cached

    # 1. Embed query
    model = _get_model()
    vec = model.encode(query, convert_to_numpy=True, normalize_embeddings=True)

    # 2. Retrieve jobs
    jobs = _vector_search(vec.tolist(), limit=20)
    if not jobs:
        return {
            "summary": "No job data available to analyze.",
            "top_skills": [],
            "top_companies": [],
            "insight": "Database may be empty.",
        }

    context = _build_context(jobs)

    # 3. Call OpenAI-compatible API
    llm = _get_llm()
    chain = _PROMPT | llm | JsonOutputParser()

    result = chain.invoke({
        "context": context,
        "query": query,
    })

    log_usage(
        prompt_tokens=len(context.split()) + len(query.split()),
        completion_tokens=len(json.dumps(result).split()),
        endpoint="rag_query",
    )

    cache_set(cache_key, result, ttl=300)
    log.info("RAG query answered: %s", query[:60])

    return result