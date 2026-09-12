"""Database engine — supports SQLite (dev) and PostgreSQL (production)."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# Fix Render PostgreSQL URL format (postgres:// → postgresql://)
_url = settings.database_url
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

# Remove async prefixes if present
_url = _url.replace("sqlite+aiosqlite", "sqlite").replace("+asyncpg", "")

# Connection args
_connect_args = {}
if _url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    _url,
    connect_args=_connect_args,
    echo=False,
    pool_pre_ping=True,  # reconnect if connection dropped
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session."""
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
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
