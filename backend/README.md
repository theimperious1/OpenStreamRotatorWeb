# OpenStreamRotator Web Backend

FastAPI backend for the OpenStreamRotator web dashboard.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env  # Fill in your Discord OAuth credentials
alembic upgrade head  # Run database migrations
uvicorn app.main:app --reload
```
