import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Sumo Online"
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "your-project-id")
    # In Cloud Run, GOOGLE_APPLICATION_CREDENTIALS is auto-handled
    # For local dev, point this to your service-account.json
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

    class Config:
        case_sensitive = True

settings = Settings()
