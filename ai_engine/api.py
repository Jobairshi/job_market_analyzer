# api.py
"""
FastAPI server for the AI Engine.

Endpoints:
  POST /resume/match       →  PDF upload, vector matching
  POST /ai/query           →  RAG-based job intelligence
  POST /ai/recommend       →  Personalized recommendations
  POST /ai/resume-match    →  Resume match + AI explanation
  POST /ai/skill-gap       →  Skill gap analysis
  GET  /health             →  Health check

Run:
    cd ai_engine && uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import logging
import os
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from resume.resume_service import process_resume_and_match, extract_text_from_pdf
from intelligence.rag_service import query_intelligence
from intelligence.match_explainer import explain_top_matches
from recommendation.recommendation_service import get_recommendations
from analysis.skill_gap import analyze_skill_gap
from ai_modules.skill_gap import analyze_skill_gap_market
from ml.salary_model import predict_salary, train_salary_model
from insights.generate_insights import (
    generate_and_store_insights,
    get_latest_insights,
    detect_trends,
)
from shared.rate_limiter import check_rate_limit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("ai_api")

app = FastAPI(
    title="AI Engine API",
    description="AI-powered job intelligence, recommendations, and resume analysis.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Rate limit helper ────────────────────────────────────────────────

def _check_limit(request: Request, endpoint: str):
    """Raise 429 if the caller exceeds 10 req/min per IP per endpoint."""
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{endpoint}"
    if not check_rate_limit(key, max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")


# ── Request / Response models ────────────────────────────────────────

class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)

class RecommendRequest(BaseModel):
    resume_text: str = Field(default="", max_length=10000)
    preferred_skills: list[str] = Field(default_factory=list)
    preferred_location: str = Field(default="")
    top_k: int = Field(default=10, ge=1, le=50)

class SkillGapRequest(BaseModel):
    resume_text: str = Field(..., min_length=10, max_length=10000)
    job_description: str = Field(..., min_length=10, max_length=10000)

class SkillGapMarketRequest(BaseModel):
    resume_text: str = Field(..., min_length=10, max_length=10000)

class SalaryPredictRequest(BaseModel):
    skills: list[str] = Field(..., min_length=1)
    location: str = Field(default="remote")
    experience: str = Field(default="mid")
    title: str = Field(default="")


# ── Endpoints ────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/resume/match")
async def resume_match(
    request: Request,
    file: UploadFile = File(...),
    top_k: int = Query(default=10, ge=1, le=50),
):
    """
    Upload a PDF resume and get the top-K matching jobs
    based on vector similarity.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted.",
        )

    if not file.content_type or "pdf" not in file.content_type.lower():
        raise HTTPException(
            status_code=400,
            detail="Invalid content type. Please upload a PDF file.",
        )

    # Save to temp file
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            if len(content) > 10 * 1024 * 1024:  # 10 MB limit
                raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")
            tmp.write(content)
            tmp_path = tmp.name

        log.info("Resume saved to %s (%d bytes)", tmp_path, len(content))

        # Process
        results = process_resume_and_match(tmp_path, top_k=top_k)

        return {
            "matches": results,
            "total": len(results),
            "resume_filename": file.filename,
        }

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Resume matching failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(exc)}")
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            log.info("Temp file cleaned up: %s", tmp_path)


# ── AI Intelligence: RAG Query ──────────────────────────────────────

@app.post("/ai/query")
async def ai_query(request: Request, body: AIQueryRequest):
    """Ask analytical questions about the job market (RAG)."""
    _check_limit(request, "ai_query")
    try:
        result = query_intelligence(body.query)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("AI query failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── AI Recommendations ──────────────────────────────────────────────

@app.post("/ai/recommend")
async def ai_recommend(request: Request, body: RecommendRequest):
    """Get personalized job recommendations."""
    _check_limit(request, "ai_recommend")
    try:
        results = get_recommendations(
            resume_text=body.resume_text,
            preferred_skills=body.preferred_skills,
            preferred_location=body.preferred_location,
            top_k=body.top_k,
        )
        return {"recommendations": results, "total": len(results)}
    except Exception as exc:
        log.error("Recommendation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── AI Resume Match + Explanation ────────────────────────────────────

@app.post("/ai/resume-match")
async def ai_resume_match(
    request: Request,
    file: UploadFile = File(...),
    top_k: int = Query(default=5, ge=1, le=20),
    explain: bool = Query(default=True),
):
    """Upload PDF, match jobs, and optionally explain top matches via AI."""
    _check_limit(request, "ai_resume_match")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            if len(content) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="File too large.")
            tmp.write(content)
            tmp_path = tmp.name

        matches = process_resume_and_match(tmp_path, top_k=top_k)

        if explain:
            resume_text = extract_text_from_pdf(tmp_path)
            matches = explain_top_matches(resume_text, matches, max_explain=min(top_k, 5))

        return {
            "matches": matches,
            "total": len(matches),
            "resume_filename": file.filename,
            "ai_explained": explain,
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        log.error("AI resume match failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Skill Gap Analysis ──────────────────────────────────────────────

@app.post("/ai/skill-gap")
async def ai_skill_gap(request: Request, body: SkillGapRequest):
    """Analyze skill gaps between a resume and a target job."""
    _check_limit(request, "ai_skill_gap")
    try:
        result = analyze_skill_gap(body.resume_text, body.job_description)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error("Skill gap analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Enhanced Skill Gap (market-based) ────────────────────────────────

@app.post("/ai/skill-gap-market")
async def ai_skill_gap_market(request: Request, body: SkillGapMarketRequest):
    """
    Enhanced skill gap: compare resume against real market demand,
    generate personalized upskilling roadmap.
    """
    _check_limit(request, "ai_skill_gap_market")
    try:
        result = analyze_skill_gap_market(body.resume_text)
        return result
    except Exception as exc:
        log.error("Market skill gap analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Salary Prediction ───────────────────────────────────────────────

@app.post("/ai/predict-salary")
async def ai_predict_salary(request: Request, body: SalaryPredictRequest):
    """Predict salary range based on skills, location, and experience."""
    _check_limit(request, "ai_predict_salary")
    try:
        result = predict_salary(
            skills=body.skills,
            location=body.location,
            experience=body.experience,
            title=body.title,
        )
        return result
    except Exception as exc:
        log.error("Salary prediction failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/ai/train-salary-model")
async def ai_train_salary(request: Request):
    """Retrain the salary prediction model with latest data."""
    _check_limit(request, "ai_train_salary")
    try:
        result = train_salary_model()
        return result
    except Exception as exc:
        log.error("Salary model training failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Market Insights ──────────────────────────────────────────────────

@app.get("/ai/insights")
async def ai_insights(request: Request, limit: int = Query(default=10, ge=1, le=50)):
    """Get the latest AI-generated market insights."""
    try:
        return {"insights": get_latest_insights(limit)}
    except Exception as exc:
        log.error("Insights fetch failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/ai/insights/trends")
async def ai_trends(request: Request):
    """Get current market trend data (24h vs 7d)."""
    try:
        return detect_trends()
    except Exception as exc:
        log.error("Trend detection failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/ai/insights/generate")
async def ai_generate_insights(request: Request):
    """Manually trigger insight generation (normally runs hourly via cron)."""
    _check_limit(request, "ai_generate_insights")
    try:
        result = generate_and_store_insights()
        return result
    except Exception as exc:
        log.error("Insight generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Skill Heatmap (geo data for a specific skill) ───────────────────

@app.get("/ai/skill-heatmap")
async def ai_skill_heatmap(request: Request, skill: str = Query(..., min_length=1)):
    """Get geo coordinates of jobs that require a specific skill."""
    try:
        from db.supabase_client import get_client
        sb = get_client()
        resp = (
            sb.table("jobs")
            .select("id, title, company, location, latitude, longitude, cleaned_tags")
            .contains("cleaned_tags", [skill.lower()])
            .filter("latitude", "not.is", "null")
            .filter("longitude", "not.is", "null")
            .limit(2000)
            .execute()
        )
        jobs = resp.data or []
        return {"skill": skill, "data": jobs, "total": len(jobs)}
    except Exception as exc:
        log.error("Skill heatmap failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
