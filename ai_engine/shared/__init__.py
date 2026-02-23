# shared/cache.py
"""In-memory TTL cache — avoids repeated LLM calls for identical queries."""

from __future__ import annotations

import hashlib
import json
import time
import threading
from typing import Any

_lock = threading.Lock()
_store: dict[str, tuple[float, Any]] = {}  # key → (expires_at, value)

DEFAULT_TTL = 300  # 5 minutes


def _make_key(*parts: Any) -> str:
    raw = json.dumps(parts, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def cache_get(key: str) -> Any | None:
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if time.time() > expires_at:
            del _store[key]
            return None
        return value


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    with _lock:
        _store[key] = (time.time() + ttl, value)


def cached(namespace: str, ttl: int = DEFAULT_TTL):
    """Decorator: cache function return value keyed on (namespace + args)."""
    def decorator(fn):
        def wrapper(*args, **kwargs):
            key = _make_key(namespace, args, kwargs)
            hit = cache_get(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            cache_set(key, result, ttl)
            return result
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator
