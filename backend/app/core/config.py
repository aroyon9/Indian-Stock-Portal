from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import field_validator  # type: ignore
from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            str(_PROJECT_ROOT / ".env"),
            str(_BACKEND_DIR / ".env"),
            ".env",
        ),
        extra="ignore",
        env_parse_delimiter=",",
    )

    user_database_url: str = "postgresql+psycopg://portal:portal_password@localhost:5432/portal_userdb"
    timescale_database_url: str = "postgresql+psycopg://timescale:timescale_password@localhost:5433/portal_pricedb"
    user_db_connect_timeout_seconds: int = 3
    user_db_socket_probe_timeout_seconds: float = 1.5
    user_db_probe_retries: int = 3
    user_db_probe_retry_delay_seconds: float = 0.4
    user_db_allow_sqlite_fallback: bool = True
    timescale_db_connect_timeout_seconds: int = 3
    timescale_db_socket_probe_timeout_seconds: float = 1.5
    timescale_db_probe_retries: int = 3
    timescale_db_probe_retry_delay_seconds: float = 0.4
    timescale_db_allow_sqlite_fallback: bool = True
    mock_data: bool = False

    jwt_secret: str = "change_me_in_dev"
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3010",
        "http://127.0.0.1:3010",
    ]

    # Indices quotes provider:
    # - "auto": prefer NSE for NIFTY 50, else Yahoo
    # - "yahoo": use Yahoo for both
    # - "nse_yahoo": try NSE for NIFTY 50, fallback to Yahoo
    indices_provider: str = "auto"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> list[str]:
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(v).strip() for v in parsed if str(v).strip()]
                except Exception:
                    pass
            return [part.strip() for part in raw.split(",") if part.strip()]
        return value


settings = Settings()
