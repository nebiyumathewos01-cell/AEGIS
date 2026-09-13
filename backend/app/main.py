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
    # Create all missing tables — never drops existing ones
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Auto-restore admin account if missing after any redeploy
    # This runs on every startup but only creates if admin doesn't exist
    try:
        from app.database import SessionLocal
        from app.services.auth_service import (
            get_user_by_email, create_user, admin_exists
        )
        db = SessionLocal()
        try:
            admin_email = os.environ.get("ADMIN_EMAIL", "nebiyumathewos01@gmail.com")
            admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@2024")
            admin_username = os.environ.get("ADMIN_USERNAME", "admin")

            if not admin_exists(db):
                # Admin missing — recreate automatically
                existing = get_user_by_email(db, admin_email)
                if not existing:
                    create_user(
                        db,
                        email=admin_email,
                        username=admin_username,
                        full_name="AEGIS Admin",
                        password=admin_password,
                        role="admin",
                    )
                    db.commit()
                    log.info("Admin account auto-restored: %s", admin_email)
                else:
                    # User exists but not admin — promote
                    existing.role = "admin"
                    db.commit()
                    log.info("Existing user promoted to admin: %s", admin_email)
        finally:
            db.close()
    except Exception as e:
        log.warning("Admin auto-restore failed: %s", e)

    log.info("AEGIS v2.1 started")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS", "version": "2.1.0"}
