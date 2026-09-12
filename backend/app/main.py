"""AEGIS — Alert Evaluation & Guided Investigation System v2.1"""
from __future__ import annotations
import logging, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
import app.models  # noqa
from app.api import (alerts, auth, audit, admin, dashboard, demo,
                     environment, integrations, investigations,
                     playbook, reports, threat_intelligence)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(
    title="AEGIS",
    description="Alert Evaluation & Guided Investigation System",
    version="2.1.0",
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

for r in (auth.router, alerts.router, audit.router, admin.router,
          dashboard.router, demo.router, environment.router,
          integrations.router, investigations.router,
          playbook.router, reports.router, threat_intelligence.router):
    app.include_router(r)


@app.on_event("startup")
def on_startup():
    log = logging.getLogger(__name__)
    try:
        from sqlalchemy import inspect as sa_inspect, text
        from app.database import engine, Base

        insp = sa_inspect(engine)
        existing = insp.get_table_names()

        # Only add missing tables — NEVER drop existing ones
        # This preserves all user data across restarts
        required = {"users", "alerts", "analyses", "investigation_notes",
                    "audit_logs", "api_keys", "environment_profiles", "playbooks"}
        missing = required - set(existing)

        if missing:
            log.info("Creating missing tables: %s", missing)
            # Create only the missing tables
            from app.database import Base
            Base.metadata.create_all(bind=engine)
            log.info("Missing tables created")
        else:
            log.info("All tables present — no schema changes needed")

    except Exception as e:
        log.warning("Schema check error: %s — running init_db()", e)
        init_db()

    os.makedirs(settings.upload_dir, exist_ok=True)
    log.info("AEGIS v2.1 started — database ready")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.1.0"}
