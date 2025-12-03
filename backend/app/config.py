from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://projecthub:projecthub@localhost:5432/projecthub"

    # JWT
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    # App
    app_name: str = "ProjectHub"
    debug: bool = True

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
