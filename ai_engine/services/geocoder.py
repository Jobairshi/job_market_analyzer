# services/geocoder.py
"""
Geocoding service — converts location text → (latitude, longitude).

Pipeline:
  1. Check in-memory LRU cache
  2. Check Supabase location_cache table
  3. Call OpenStreetMap Nominatim API (with rate-limiting)
  4. Cache result in DB + memory

Safety:
  - "Remote" / empty → returns None (no API call)
  - 1-second sleep between Nominatim calls (their usage policy)
  - 5-second request timeout
  - In-memory LRU (max 2048 entries) to minimize DB reads
"""

from __future__ import annotations

import logging
import re
import time
from functools import lru_cache
from typing import Optional

import requests

from db.supabase_client import get_client

log = logging.getLogger("geocoder")

# ── Configuration ────────────────────────────────────────────────────
_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_USER_AGENT = "JobMarketAnalyzer/1.0 (https://github.com/Jobairshi/job_market_analyzer)"
_REQUEST_TIMEOUT = 5  # seconds
_RATE_LIMIT_SLEEP = 1.1  # seconds between Nominatim calls

# Track last API call time for rate limiting
_last_api_call: float = 0.0

# Patterns that indicate a non-geocodable location
_REMOTE_PATTERNS = re.compile(
    r"^(remote|anywhere|worldwide|global|distributed|work\s*from\s*home|wfh|n/?a|various|multiple|flexible)$",
    re.IGNORECASE,
)


def _is_remote(location: str) -> bool:
    """Return True if the location is remote / not geocodable."""
    text = location.strip()
    if not text:
        return True
    return bool(_REMOTE_PATTERNS.match(text))


def _normalize_key(location: str) -> str:
    """Normalize location text for cache lookups."""
    return " ".join(location.lower().strip().split())


# ── In-memory LRU cache ─────────────────────────────────────────────

@lru_cache(maxsize=2048)
def _memory_cache_get(key: str) -> Optional[tuple[float, float]]:
    """LRU wrapper — returns are cached automatically by functools."""
    # Actual lookup happens in the main function; this is just the cache stub
    return None  # sentinel: means "not in memory cache"


def _memory_cache_set(key: str, lat: float, lng: float) -> None:
    """Force a value into the LRU cache by clearing and replaying."""
    # Replace the cached value by calling with cache bypass
    _memory_cache_get.cache_clear()  # simple approach for a small cache


# We'll use a plain dict for fast memory caching instead (simpler + thread-safe enough)
_mem_cache: dict[str, tuple[float, float]] = {}
_MEM_CACHE_MAX = 2048


def _mem_get(key: str) -> Optional[tuple[float, float]]:
    return _mem_cache.get(key)


def _mem_set(key: str, lat: float, lng: float) -> None:
    if len(_mem_cache) >= _MEM_CACHE_MAX:
        # Evict oldest ~25%
        keys = list(_mem_cache.keys())
        for k in keys[: len(keys) // 4]:
            _mem_cache.pop(k, None)
    _mem_cache[key] = (lat, lng)


# ── DB cache layer ──────────────────────────────────────────────────

def _db_cache_get(location_key: str) -> Optional[tuple[float, float]]:
    """Look up location_cache table in Supabase."""
    try:
        client = get_client()
        resp = (
            client.table("location_cache")
            .select("latitude, longitude")
            .eq("location_text", location_key)
            .limit(1)
            .execute()
        )
        if resp.data:
            row = resp.data[0]
            return (row["latitude"], row["longitude"])
    except Exception as exc:
        log.warning("location_cache lookup failed: %s", exc)
    return None


def _db_cache_set(location_key: str, lat: float, lng: float) -> None:
    """Insert into location_cache (ignore conflict on duplicate location_text)."""
    try:
        client = get_client()
        client.table("location_cache").upsert(
            {
                "location_text": location_key,
                "latitude": lat,
                "longitude": lng,
            },
            on_conflict="location_text",
        ).execute()
    except Exception as exc:
        log.warning("Failed to cache location '%s': %s", location_key, exc)


# ── Nominatim API ───────────────────────────────────────────────────

def _call_nominatim(query: str) -> Optional[tuple[float, float]]:
    """
    Call OpenStreetMap Nominatim geocoding API.
    Respects rate limit (1 req/sec) and returns (lat, lng) or None.
    """
    global _last_api_call

    # Rate limiting
    elapsed = time.time() - _last_api_call
    if elapsed < _RATE_LIMIT_SLEEP:
        time.sleep(_RATE_LIMIT_SLEEP - elapsed)

    try:
        resp = requests.get(
            _NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": _USER_AGENT},
            timeout=_REQUEST_TIMEOUT,
        )
        _last_api_call = time.time()
        resp.raise_for_status()

        data = resp.json()
        if data:
            lat = float(data[0]["lat"])
            lng = float(data[0]["lon"])
            log.info("Geocoded '%s' → (%.4f, %.4f)", query, lat, lng)
            return (lat, lng)
        else:
            log.info("Nominatim returned no results for '%s'", query)
    except requests.RequestException as exc:
        log.error("Nominatim request failed for '%s': %s", query, exc)
    except (KeyError, IndexError, ValueError) as exc:
        log.error("Failed to parse Nominatim response for '%s': %s", query, exc)

    return None


# ── Public API ───────────────────────────────────────────────────────

def geocode_location(location_text: str) -> Optional[tuple[float, float]]:
    """
    Convert a location string to (latitude, longitude).

    Lookup order:
      1. In-memory LRU cache
      2. Supabase location_cache table
      3. Nominatim API (result cached in both layers)

    Returns None for "Remote", empty, or unresolvable locations.
    """
    if not location_text or _is_remote(location_text):
        return None

    key = _normalize_key(location_text)

    # 1. Memory cache
    cached = _mem_get(key)
    if cached is not None:
        return cached

    # 2. DB cache
    db_hit = _db_cache_get(key)
    if db_hit is not None:
        _mem_set(key, db_hit[0], db_hit[1])
        return db_hit

    # 3. Nominatim API
    result = _call_nominatim(location_text.strip())
    if result is not None:
        _mem_set(key, result[0], result[1])
        _db_cache_set(key, result[0], result[1])
        return result

    return None


def geocode_batch(locations: list[str]) -> dict[str, Optional[tuple[float, float]]]:
    """
    Geocode a list of location strings. Returns {location_text: (lat, lng) | None}.
    Efficient: deduplicates, caches, and rate-limits automatically.
    """
    results: dict[str, Optional[tuple[float, float]]] = {}
    seen: set[str] = set()

    for loc in locations:
        key = _normalize_key(loc) if loc else ""
        if key in seen:
            results[loc] = results.get(loc)
            continue
        seen.add(key)
        results[loc] = geocode_location(loc)

    return results
