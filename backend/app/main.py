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
    import os
    log = logging.getLogger(__name__)
    try:
        from sqlalchemy import inspect as sa_inspect
        from app.database import engine
        insp = sa_inspect(engine)
        existing = insp.get_table_names()
        log.info("Existing tables: %s", existing)
        if "users" not in existing:
            log.info("users table missing — recreating database")
            db_path = settings.database_url.replace("sqlite:///", "")
            if db_path.startswith("/"):
                pass
            else:
                db_path = db_path.lstrip("/")
            if os.path.exists(db_path):
                os.remove(db_path)
                log.info("Old database removed: %s", db_path)
    except Exception as e:
        log.warning("Schema check failed: %s", e)
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    log.info("AEGIS v2.0 started — tables ready")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.0.0"}
