import firebase_admin
from firebase_admin import credentials, firestore
from app.core.config import settings
import logging

# Initialize Firebase App
# In Cloud Run, default credentials work automatically.
# Locally, it looks for GOOGLE_APPLICATION_CREDENTIALS env var.

if not firebase_admin._apps:
    try:
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
            firebase_admin.initialize_app(cred)
        else:
            # Use Application Default Credentials (ADC) for Cloud Run
            firebase_admin.initialize_app()
        logging.info("Firebase Admin Initialized")
    except Exception as e:
        logging.error(f"Failed to initialize Firebase: {e}")

def get_db():
    return firestore.client()
