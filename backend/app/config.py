"""Application configuration loaded from environment variables."""
from __future__ import annotations
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    app_secret_key: str = "dev-secret-key-change-in-production"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Database — Railway uses /tmp for writable storage
    database_url: str = "sqlite:///./aegis.db"

    # AI / Ollama (optional — app works without it)
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # OpenAI-compatible fallback (optional)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    # Threat Intelligence (optional)
    virustotal_api_key: str = ""

    # CORS — set to your Vercel URL after deploying frontend
    cors_origins: str = "http://localhost:5173,http://localhost:3000,https://aegis-eta-two.vercel.app,https://aegis-frontend.vercel.app"

    # File Upload
    max_upload_size_mb: int = 5
    upload_dir: str = "/tmp/uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
