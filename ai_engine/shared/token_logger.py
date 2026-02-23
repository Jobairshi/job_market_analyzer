# shared/token_logger.py
"""Lightweight OpenAI token-usage logger."""

from __future__ import annotations

import logging
import threading

log = logging.getLogger("token_usage")
_lock = threading.Lock()
_total = {"prompt": 0, "completion": 0, "calls": 0}


def log_usage(prompt_tokens: int, completion_tokens: int, endpoint: str = "") -> None:
    with _lock:
        _total["prompt"] += prompt_tokens
        _total["completion"] += completion_tokens
        _total["calls"] += 1
    log.info(
        "[%s] tokens: prompt=%d completion=%d | cumulative: prompt=%d completion=%d calls=%d",
        endpoint,
        prompt_tokens,
        completion_tokens,
        _total["prompt"],
        _total["completion"],
        _total["calls"],
    )


def get_totals() -> dict:
    with _lock:
        return dict(_total)
