# shared/rate_limiter.py
"""Simple in-memory per-key rate limiter for AI endpoints."""

from __future__ import annotations

import time
import threading
from collections import defaultdict

_lock = threading.Lock()
_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(
    key: str,
    max_requests: int = 10,
    window_seconds: int = 60,
) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    cutoff = now - window_seconds
    with _lock:
        timestamps = _buckets[key]
        # Prune old entries
        _buckets[key] = [t for t in timestamps if t > cutoff]
        if len(_buckets[key]) >= max_requests:
            return False
        _buckets[key].append(now)
        return True
