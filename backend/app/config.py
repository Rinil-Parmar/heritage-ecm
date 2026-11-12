from pydantic import HttpUrl, Field
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
