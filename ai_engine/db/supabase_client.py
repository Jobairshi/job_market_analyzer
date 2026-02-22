# db/supabase_client.py
"""
Singleton Supabase client.

Credentials are loaded via config.settings (which reads from .env).
Call get_client() everywhere — only one connection is created per process.
"""

from __future__ import annotations

import logging

from supabase import create_client, Client

from config.settings import settings

log = logging.getLogger("supabase_client")

_client: Client | None = None


def get_client() -> Client:
    """
    Return a reusable Supabase client (created once per process).

    Raises:
        EnvironmentError: propagated from settings if credentials are missing.
    """
    global _client
    if _client is not None:
        return _client

    _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    log.info("Supabase client initialised (URL: %s…)", settings.supabase_url[:30])
    return _client
