from pydantic_settings import BaseSettings
from typing import Dict, Any

class Settings(BaseSettings):
    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Web Scraper ML Service"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ML Model Configuration
    MODEL_PATH: str = "models"
    CONFIDENCE_THRESHOLD: float = 0.85
    TRAINING_INTERVAL: int = 3600  # seconds

    # Service Integration
    SCRAPER_SERVICE_URL: str = "http://localhost:3000"
    MAX_BATCH_SIZE: int = 100

    # Security
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60  # seconds

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()