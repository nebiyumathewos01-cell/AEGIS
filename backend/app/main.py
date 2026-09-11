"""AEGIS — Alert Evaluation & Guided Investigation System v2.0"""
from __future__ import annotations
import logging, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
import app.models  # noqa
from app.api import alerts, auth, audit, admin, dashboard, demo, investigations, reports, threat_intelligence

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

for r in (auth.router, alerts.router, audit.router, admin.router, dashboard.router,
          demo.router, investigations.router, reports.router,
          threat_intelligence.router):
    app.include_router(r)


@app.on_event("startup")
def on_startup():
    log = logging.getLogger(__name__)
    try:
        from sqlalchemy import inspect as sa_inspect
        from app.database import engine, Base
        insp = sa_inspect(engine)
        existing = insp.get_table_names()
        needs_recreate = False
        if "users" not in existing or "audit_logs" not in existing:
            needs_recreate = True
        # Check for removed columns (approval_status removed in v2.1)
        if not needs_recreate and "users" in existing:
            cols = [c["name"] for c in insp.get_columns("users")]
            # If old schema has approval_status, recreate clean
            if "approval_status" in cols:
                log.info("Old schema detected — recreating tables")
                needs_recreate = True
        if needs_recreate:
            Base.metadata.drop_all(bind=engine)
            log.info("Tables dropped for recreation")
    except Exception as e:
        log.warning("Schema check: %s", e)
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    log.info("AEGIS v2.1 started")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.0.0"}
