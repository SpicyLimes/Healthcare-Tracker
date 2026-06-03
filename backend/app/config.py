from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = (
        "postgresql+psycopg://healthtracker:change-me-in-real-env@db:5432/healthtracker"
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
