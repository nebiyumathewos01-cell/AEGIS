"""AEGIS — Alert Evaluation & Guided Investigation System v2.1"""
from __future__ import annotations
import logging, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
import app.models  # noqa
from app.api import alerts, auth, audit, admin, dashboard, demo, integrations, investigations, reports, threat_intelligence

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
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
          dashboard.router, demo.router, integrations.router,
          investigations.router, reports.router, threat_intelligence.router):
    app.include_router(r)


@app.on_event("startup")
def on_startup():
    log = logging.getLogger(__name__)
    needs_recreate = False
    try:
        from sqlalchemy import inspect as sa_inspect
        from app.database import engine, Base
        insp = sa_inspect(engine)
        existing = insp.get_table_names()

        required_tables = {"users", "audit_logs", "api_keys", "alerts",
                           "analyses", "investigation_notes"}
        if not required_tables.issubset(set(existing)):
            log.info("Missing tables — recreating schema")
            needs_recreate = True

        # Detect old schema with approval_status column
        if not needs_recreate and "users" in existing:
            cols = [c["name"] for c in insp.get_columns("users")]
            if "approval_status" in cols:
                log.info("Old schema (approval_status) detected — recreating")
                needs_recreate = True

        if needs_recreate:
            Base.metadata.drop_all(bind=engine)
            log.info("Old tables dropped")

    except Exception as e:
        log.warning("Schema check error: %s", e)
        needs_recreate = True
        try:
            from app.database import engine, Base
            Base.metadata.drop_all(bind=engine)
        except Exception:
            pass

    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    log.info("AEGIS v2.1 started — all tables ready")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.1.0"}
