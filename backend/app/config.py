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
    cookie_secure: bool = False

    # File uploads
    uploads_root: str = "/app/uploads"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
