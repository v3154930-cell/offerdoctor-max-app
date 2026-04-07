from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    BASE_DIR: Path = Path(__file__).parent.parent
    DATABASE_URL: str = "sqlite:///./knowledge.db"
    APP_NAME: str = "Knowledge Engine"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()