"""AEGIS — Alert Evaluation & Guided Investigation System — FastAPI entry point."""
from __future__ import annotations
import logging, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
import app.models  # noqa — registers all ORM classes
from app.api import alerts, dashboard, demo, investigations, reports, threat_intelligence

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(
    title="AEGIS",
    description="Alert Evaluation & Guided Investigation System — AI-powered security alert triage platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

for r in (alerts.router, dashboard.router, demo.router,
          investigations.router, reports.router, threat_intelligence.router):
    app.include_router(r)


@app.on_event("startup")
def on_startup():
    init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    logging.getLogger(__name__).info("AEGIS started")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AEGIS"}
