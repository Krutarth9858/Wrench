import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Wrench API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str

    # Security
    # No default: a missing SECRET_KEY must fail startup loudly rather than
    # silently signing tokens with a value that is public in version control.
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS: explicit origins only, never "*".
    # Declared as a plain string because pydantic-settings JSON-decodes complex
    # types from .env before validators run; `cors_origins` parses it instead.
    # Accepts a comma-separated list or a JSON array.
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        raw = self.BACKEND_CORS_ORIGINS.strip()
        if raw.startswith("["):
            return [str(o).strip() for o in json.loads(raw)]
        return [o.strip() for o in raw.split(",") if o.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
