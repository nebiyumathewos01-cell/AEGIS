"""Synchronous SQLAlchemy engine + session factory.

Uses SQLite with a thread-local session. FastAPI routes that need DB access
run via run_in_executor so the event loop is never blocked.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# Convert async URL to sync URL if needed
_url = settings.database_url.replace("sqlite+aiosqlite", "sqlite").replace("+asyncpg", "")

engine = create_engine(
    _url,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a synchronous DB session."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Call once at startup."""
    Base.metadata.create_all(bind=engine)
