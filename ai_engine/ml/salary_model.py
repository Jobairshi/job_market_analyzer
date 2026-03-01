# ml/salary_model.py
"""
Salary Prediction ML Model — lightweight RandomForest regressor.

Training features:
  - skill_count (int)
  - location_encoded (category → int)
  - experience_level (junior=0, mid=1, senior=2, lead=3)
  - title_embedding (384-dim sentence-transformer vector)

Target:
  - estimated_salary (float)

Since many job listings lack explicit salary data, we use an LLM-augmented
synthetic estimation approach: for jobs with titles/skills/locations, we
estimate salary ranges that serve as training targets, then train a fast
local model for instant inference.
"""

from __future__ import annotations

import hashlib
import json
import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

from config.settings import settings
from db.supabase_client import get_client
from shared import cache_get, cache_set, _make_key

log = logging.getLogger("salary_model")

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODEL_DIR / "salary_model.pkl"
ENCODER_PATH = MODEL_DIR / "salary_encoders.pkl"

# ── Experience keywords ──────────────────────────────────────────────

_EXP_MAP = {
    "intern": 0, "junior": 0, "entry": 0, "graduate": 0, "trainee": 0,
    "mid": 1, "intermediate": 1,
    "senior": 2, "sr": 2, "staff": 2, "principal": 2,
    "lead": 3, "head": 3, "director": 3, "vp": 3, "manager": 3, "chief": 3,
}


def _infer_experience(title: str) -> int:
    """Infer experience level from job title."""
    title_lower = title.lower()
    for keyword, level in _EXP_MAP.items():
        if keyword in title_lower:
            return level
    return 1  # default: mid


# ── Salary estimation heuristic (when no salary data exists) ─────────

# Base salaries by experience level (USD/year), used as synthetic targets
_BASE_SALARY = {0: 45000, 1: 75000, 2: 110000, 3: 145000}

# Skill premium multipliers (high-demand skills increase estimate)
_SKILL_PREMIUMS = {
    "python": 1.05, "javascript": 1.03, "react": 1.06, "typescript": 1.07,
    "aws": 1.10, "kubernetes": 1.12, "docker": 1.05, "go": 1.10,
    "rust": 1.12, "java": 1.04, "c++": 1.06, "machine learning": 1.15,
    "deep learning": 1.15, "ai": 1.12, "blockchain": 1.10, "solidity": 1.10,
    "scala": 1.08, "ruby": 1.03, "swift": 1.05, "kotlin": 1.05,
    "devops": 1.08, "terraform": 1.10, "sql": 1.02, "graphql": 1.04,
    "node.js": 1.04, "vue": 1.03, "angular": 1.03, "figma": 0.95,
}

# Location cost-of-living multiplier
_LOCATION_MULT = {
    "san francisco": 1.4, "new york": 1.35, "london": 1.25, "seattle": 1.3,
    "los angeles": 1.2, "boston": 1.2, "austin": 1.1, "chicago": 1.1,
    "berlin": 1.0, "toronto": 1.05, "remote": 1.0, "singapore": 1.15,
    "dubai": 1.15, "sydney": 1.15, "tokyo": 1.2, "amsterdam": 1.1,
}


def _estimate_salary(title: str, skills: list[str], location: str) -> float:
    """Heuristic salary estimate for training data generation."""
    exp = _infer_experience(title)
    base = _BASE_SALARY[exp]

    # Skill premiums (multiplicative, capped)
    premium = 1.0
    for skill in skills[:10]:
        premium *= _SKILL_PREMIUMS.get(skill.lower(), 1.0)
    premium = min(premium, 1.5)

    # Location multiplier
    loc_lower = location.lower() if location else "remote"
    loc_mult = 1.0
    for city, mult in _LOCATION_MULT.items():
        if city in loc_lower:
            loc_mult = mult
            break

    return round(base * premium * loc_mult, -2)


# ── Training ─────────────────────────────────────────────────────────

def _build_feature_vector(
    skill_count: int,
    location_code: int,
    experience: int,
    embedding: list[float] | None = None,
) -> np.ndarray:
    """Build feature vector for a single sample."""
    base = [skill_count, location_code, experience]
    if embedding and len(embedding) == settings.embedding_dim:
        return np.array(base + embedding, dtype=np.float32)
    else:
        return np.array(base + [0.0] * settings.embedding_dim, dtype=np.float32)


def train_salary_model(max_samples: int = 5000) -> dict[str, Any]:
    """
    Build training data from jobs table and train RandomForest.
    Returns training stats.
    """
    from sklearn.ensemble import RandomForestRegressor  # noqa: local import

    sb = get_client()
    log.info("Fetching jobs for salary model training...")

    resp = (
        sb.table("jobs")
        .select("title, company, location, cleaned_tags, embedding")
        .filter("cleaned_tags", "not.is", "null")
        .limit(max_samples)
        .execute()
    )
    rows = resp.data or []
    log.info("Fetched %d jobs for training", len(rows))

    if len(rows) < 20:
        return {"error": "Not enough data to train", "sample_count": len(rows)}

    # Build location encoder
    locations: list[str] = []
    for r in rows:
        loc = (r.get("location") or "remote").lower().strip()
        if loc not in locations:
            locations.append(loc)
    loc_to_code = {loc: i for i, loc in enumerate(locations)}

    X_list, y_list = [], []

    for r in rows:
        title = r.get("title", "")
        skills = r.get("cleaned_tags") or []
        location = (r.get("location") or "remote").lower().strip()
        embedding = r.get("embedding")

        experience = _infer_experience(title)
        loc_code = loc_to_code.get(location, 0)

        feat = _build_feature_vector(len(skills), loc_code, experience, embedding)
        target = _estimate_salary(title, skills, location)

        X_list.append(feat)
        y_list.append(target)

    X = np.array(X_list)
    y = np.array(y_list)

    # Train
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    # Save
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    with open(ENCODER_PATH, "wb") as f:
        pickle.dump({"loc_to_code": loc_to_code, "locations": locations}, f)

    # Stats
    preds = model.predict(X)
    mae = float(np.mean(np.abs(preds - y)))
    r2 = float(model.score(X, y))

    log.info("Model trained: R²=%.3f, MAE=$%.0f, samples=%d", r2, mae, len(y))
    return {
        "samples": len(y),
        "r2_score": round(r2, 4),
        "mae": round(mae, 2),
        "feature_dim": X.shape[1],
        "model_path": str(MODEL_PATH),
    }


# ── Inference ────────────────────────────────────────────────────────

_model = None
_encoders = None


def _load_model():
    global _model, _encoders
    if _model is not None:
        return

    if not MODEL_PATH.exists():
        log.warning("No trained model found at %s — training now...", MODEL_PATH)
        train_salary_model()

    with open(MODEL_PATH, "rb") as f:
        _model = pickle.load(f)
    with open(ENCODER_PATH, "rb") as f:
        _encoders = pickle.load(f)
    log.info("Salary model loaded.")


def predict_salary(
    skills: list[str],
    location: str = "remote",
    experience: str = "mid",
    title: str = "",
) -> dict[str, Any]:
    """
    Predict salary range for given profile.
    Returns {predicted_salary, salary_range, confidence_score, factors}.
    """
    cache_key = _make_key(
        "salary_pred",
        ",".join(sorted(s.lower() for s in skills[:15])),
        location.lower(),
        experience.lower(),
    )
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    _load_model()

    exp_map = {"junior": 0, "entry": 0, "mid": 1, "intermediate": 1,
               "senior": 2, "lead": 3, "director": 3}
    exp_level = exp_map.get(experience.lower(), 1)

    loc_code = _encoders["loc_to_code"].get(location.lower().strip(), 0)

    # Try to get embedding for the job title
    embedding = None
    if title:
        try:
            from sentence_transformers import SentenceTransformer
            m = SentenceTransformer(settings.embedding_model)
            embedding = m.encode(title).tolist()
        except Exception:
            pass

    feat = _build_feature_vector(len(skills), loc_code, exp_level, embedding)
    feat = feat.reshape(1, -1)

    prediction = float(_model.predict(feat)[0])

    # Get prediction interval from forest estimators
    tree_preds = np.array([t.predict(feat)[0] for t in _model.estimators_])
    std = float(np.std(tree_preds))
    low = max(20000, prediction - 1.5 * std)
    high = prediction + 1.5 * std

    # Confidence: inverse of coefficient of variation
    cv = std / max(prediction, 1)
    confidence = round(max(0, min(1, 1 - cv)) * 100, 1)

    result = {
        "predicted_salary": round(prediction, -2),
        "salary_range": {
            "min": round(low, -2),
            "max": round(high, -2),
        },
        "confidence_score": confidence,
        "currency": "USD",
        "factors": {
            "experience_level": experience,
            "skill_count": len(skills),
            "location": location,
            "top_premium_skills": [
                s for s in skills if s.lower() in _SKILL_PREMIUMS
            ][:5],
        },
    }

    cache_set(cache_key, result, ttl=21600)  # 6 hours
    return result
