from typing import Literal

from pydantic import HttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ECM_", extra="ignore")

    mayan_api_url: HttpUrl = "https://archeoecm.cs.uwindsor.ca/api/v4/"
    request_timeout: float = Field(default=10, gt=0, le=60)
    trusted_origins: list[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://127.0.0.1:8001", "http://localhost:8001",
    ]
    cookie_secure: bool = False  # Local HTTP only; HTTPS deployment must set True.
    session_seconds: int = Field(default=3600, ge=60, le=86400)
    ai_provider: Literal["disabled", "openai"] = "disabled"
    ai_model: str = Field(default="gpt-6-luna", min_length=1, max_length=100)
    ai_api_key: SecretStr | None = None
    ai_timeout: float = Field(default=20, gt=0, le=60)
    ai_searches_per_minute: int = Field(default=10, ge=1, le=60)
    ai_searches_per_day: int = Field(default=200, ge=1, le=10000)
