
# Backend Directory Structure

This document outlines the proposed structure for the cloud-hosted Sumo backend.

## root/backend/

The backend is isolated from the `web/` directory.

### app/

* **main.py**: The entry point for the FastAPI server. Contains the `MatchManager` and WebSocket routes.
* **core/**: Core business logic.
  * **engine.py**: The pure Python `SumoEngine` class. The "Headless" simulation.
  * **config.py**: Environment variables and settings.
* **api/**: REST API Routes (separated from main.py for scale).
  * **wrestlers.py**: CRUD for wrestler profiles.
  * **users.py**: User profile management.
* **models/**: Pydantic models and DB schemas.
  * **wrestler.py**: Data shape for wrestlers.
* **services/**: External integrations.
  * **firebase.py**: `firebase_admin` initialization and Firestore helpers.

### Root Files

* **requirements.txt**: Python dependencies.
* **Dockerfile**: For deploying to Cloud Run.
* **.env**: Local secrets (not committed).

## Usage

1. `cd backend`
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload`
