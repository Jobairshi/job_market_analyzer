# config/settings.py
"""
Central settings module. Loads environment variables from .env once
and exposes them as typed attributes. Import `settings` anywhere instead
of calling os.getenv() directly.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (two levels up from this file)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2025-01-01-preview"
    azure_deployment_name: str = "gpt-4o"
    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384
    embedding_batch_size: int = 100   # jobs fetched + embedded per cycle


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise EnvironmentError(
            f"Missing required environment variable: {name}\n"
            f"Set it in {_ENV_PATH}"
        )
    return value


# Single shared instance — import this everywhere
settings = Settings(
    supabase_url=_require("SUPABASE_URL"),
    supabase_service_role_key=_require("SUPABASE_SERVICE_ROLE_KEY"),
    azure_openai_api_key=os.getenv("AZURE_OPENAI_API_KEY", ""),
    azure_openai_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
    azure_openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    azure_deployment_name=os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-4o"),
)
