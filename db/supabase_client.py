# db/supabase_client.py
"""
Singleton Supabase client.

Loads credentials from .env and exposes a single `get_client()` function
that returns a reusable Supabase client instance.

Environment variables required:
    SUPABASE_URL              – Project URL  (e.g. https://xyz.supabase.co)
    SUPABASE_SERVICE_ROLE_KEY – Service-role key (NOT the anon key)
"""

from __future__ import annotations

import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# ── Load .env from project root ─────────────────────────────────────
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

log = logging.getLogger("supabase_client")

# ── Module-level singleton ───────────────────────────────────────────
_client: Client | None = None


def get_client() -> Client:
    """
    Return a reusable Supabase client (created once per process).

    Raises:
        EnvironmentError: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
                          is not set.
    """
    global _client

    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise EnvironmentError(
            "Missing Supabase credentials.\n"
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.\n"
            f"Looked for .env at: {_ENV_PATH}"
        )

    _client = create_client(url, key)
    log.info("Supabase client initialised (URL: %s…)", url[:30])
    return _client
