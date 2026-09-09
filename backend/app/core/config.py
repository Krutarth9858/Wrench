import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Wrench API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    #: "development" | "production". Production configuration is checked at
    #: startup by app/core/preflight.py.
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Security
    # No default: a missing SECRET_KEY must fail startup loudly rather than
    # silently signing tokens with a value that is public in version control.
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LLM (RAD section 4). Defaults to an offline stub so the app runs and the
    # test suite passes without credentials or network access.
    LLM_PROVIDER: str = "stub"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.0-flash"

    # Google Sign-In (authorization-code flow). The secret never leaves the
    # server; only the client id is ever sent to a browser. Obtain these from
    # Google Cloud Console -> APIs & Services -> Credentials -> OAuth client ID
    # (type: Web application), and register GOOGLE_REDIRECT_URI there verbatim.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5174/auth/google/callback"

    # Transactional email. Defaults to an offline provider so the app runs and
    # the suite passes without an account, mirroring LLM_PROVIDER/PAYMENT_PROVIDER.
    EMAIL_PROVIDER: str = "console"
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = "Wrench <onboarding@resend.dev>"

    # Email OTP policy. Configured here, never hardcoded at a call site.
    OTP_LENGTH: int = 6
    OTP_EXPIRY_MINUTES: int = 10
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_ATTEMPTS: int = 5
    #: Requests allowed per email per window, and per client address per window.
    OTP_MAX_REQUESTS_PER_HOUR: int = 5
    OTP_MAX_VERIFY_PER_HOUR: int = 20

    # The timezone appointment wall-clock times are expressed in — the local
    # time at the service location. System timestamps stay UTC regardless.
    # Any IANA name; the deployment region decides it.
    APP_TIMEZONE: str = "Asia/Kolkata"

    # Payments (Scheduled Service). Defaults to an offline stub so the app runs
    # and the test suite passes without a payment account, mirroring LLM_PROVIDER.
    PAYMENT_PROVIDER: str = "stub"
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    # Configured on the webhook in the Razorpay dashboard — a different
    # credential from the API secret above.
    RAZORPAY_WEBHOOK_SECRET: str = ""
    PAYMENT_CURRENCY: str = "INR"

    # CORS: explicit origins only, never "*".
    # Declared as a plain string because pydantic-settings JSON-decodes complex
    # types from .env before validators run; `cors_origins` parses it instead.
    # Accepts a comma-separated list or a JSON array.
    BACKEND_CORS_ORIGINS: str = "http://localhost:5174"

    @property
    def cors_origins(self) -> List[str]:
        raw = self.BACKEND_CORS_ORIGINS.strip()
        if raw.startswith("["):
            return [str(o).strip() for o in json.loads(raw)]
        return [o.strip() for o in raw.split(",") if o.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
