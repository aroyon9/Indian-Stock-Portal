from __future__ import annotations

import socket
import time
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _is_postgres_url(database_url: str) -> bool:
    scheme = urlsplit(database_url).scheme.lower()
    return "postgresql" in scheme or "psycopg" in scheme


def _engine_connect_args(database_url: str) -> dict[str, int | bool]:
    if _is_postgres_url(database_url):
        return {"connect_timeout": settings.timescale_db_connect_timeout_seconds}
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def _is_timescale_reachable(database_url: str) -> bool:
    parsed = urlsplit(database_url)
    if not _is_postgres_url(database_url):
        return True

    host = parsed.hostname
    if not host:
        return False

    port = parsed.port or 5432
    retries = max(1, int(settings.timescale_db_probe_retries))
    timeout = max(0.2, float(settings.timescale_db_socket_probe_timeout_seconds))
    delay = max(0.0, float(settings.timescale_db_probe_retry_delay_seconds))
    for attempt in range(retries):
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            if attempt < retries - 1 and delay > 0:
                time.sleep(delay)
    return False


def _sqlite_fallback_url() -> str:
    fallback_path = Path(__file__).resolve().parents[2] / ".data" / "timescaledb.sqlite3"
    fallback_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{fallback_path.as_posix()}"


def _resolve_timescale_database_url() -> str:
    configured_url = settings.timescale_database_url
    if not _is_postgres_url(configured_url):
        return configured_url

    if _is_timescale_reachable(configured_url):
        return configured_url

    if not settings.timescale_db_allow_sqlite_fallback:
        parsed = urlsplit(configured_url)
        host = parsed.hostname or "unknown-host"
        port = parsed.port or 5432
        dbname = (parsed.path or "/").lstrip("/") or "unknown-db"
        raise RuntimeError(
            "[timescale_db] primary database is unreachable and fallback is disabled. "
            f"Target={host}:{port}/{dbname}"
        )

    fallback_url = _sqlite_fallback_url()
    parsed = urlsplit(configured_url)
    host = parsed.hostname or "unknown-host"
    port = parsed.port or 5432
    dbname = (parsed.path or "/").lstrip("/") or "unknown-db"
    print(
        "[timescale_db] primary database is unreachable; "
        f"target={host}:{port}/{dbname}; "
        f"using local SQLite fallback at {fallback_url}"
    )
    return fallback_url


active_timescale_database_url = _resolve_timescale_database_url()

engine = create_engine(
    active_timescale_database_url,
    pool_pre_ping=True,
    connect_args=_engine_connect_args(active_timescale_database_url),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_timescale_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_timescale_db() -> None:
    # Ensure market tables exist in local/dev environments.
    from app.models import ohlcv as _ohlcv_model  # noqa: F401
    from app.models import screener as _screener_model  # noqa: F401
    from app.models import symbol as _symbol_model  # noqa: F401

    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        print(f"[timescale_db] init skipped: {exc}")
