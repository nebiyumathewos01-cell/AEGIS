"""AEGIS — Alert Evaluation & Guided Investigation System."""
from __future__ import annotations
import logging, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
import app.models  # noqa
from app.api import alerts, auth, dashboard, demo, investigations, reports, threat_intelligence

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(
    title="AEGIS",
    description="Alert Evaluation & Guided Investigation System",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, alerts.router, dashboard.router, demo.router,
          investigations.router, reports.router, threat_intelligence.router):
    app.include_router(r)


@app.on_event("startup")
def on_startup():
    # Delete old DB if it doesn't have the users table (schema migration)
    import os
    from sqlalchemy import inspect
    try:
        from app.database import engine
        insp = inspect(engine)
        if "users" not in insp.get_table_names():
            db_path = settings.database_url.replace("sqlite:///", "").replace("sqlite:////", "/")
            if os.path.exists(db_path):
                os.remove(db_path)
    except Exception:
        pass
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    logging.getLogger(__name__).info("AEGIS v2.0 started")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.0.0"}
