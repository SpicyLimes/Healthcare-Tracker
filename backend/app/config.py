from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = (
        "postgresql+psycopg://healthtracker:change-me-in-real-env@db:5432/healthtracker"
    )

    # Auth / JWT
    jwt_secret: str = "dev-only-insecure-secret-change-in-real-env"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7

    # First-admin seed (only used when the users table is empty)
    initial_admin_email: str = "admin@example.com"
    initial_admin_password: str = "change-me-in-real-env"

    # Cookies: secure=True in production (HTTPS only); may be False for local HTTP dev
    cookie_secure: bool = True

    # File uploads
    uploads_root: str = "/app/uploads"

    # --- Email (transactional) ---
    email_backend: str = "console"  # "smtp" to actually send; "console" logs only
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "Healthcare Tracker <noreply@example.com>"
    email_footer: str = ""
    # Absolute base URL for links built server-side (no browser origin available in email)
    app_base_url: str = "http://localhost:1337"

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        if "insecure" in self.jwt_secret or len(self.jwt_secret) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters and must not contain 'insecure'. "
                "Set a strong random value in your .env file."
            )
        if "change-me" in self.database_url:
            raise ValueError(
                "DATABASE_URL still contains the placeholder value 'change-me'. "
                "Set a real database URL in your .env file."
            )
        if "change-me" in self.initial_admin_password:
            raise ValueError(
                "INITIAL_ADMIN_PASSWORD still contains the placeholder value 'change-me'. "
                "Set a strong password in your .env file."
            )
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
