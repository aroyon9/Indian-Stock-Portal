# Backend (FastAPI)

FastAPI service providing:

- JWT auth (`/api/v1/auth/*`)
- User profile (`/api/v1/me`)
- Market data endpoints backed by TimescaleDB (`/api/v1/stocks`, `/api/v1/ohlcv/{symbol}`)

## Local run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Env vars: see `app/core/config.py`.

### User DB notes

- Primary user DB defaults to PostgreSQL at `localhost:5432`.
- If PostgreSQL is unreachable, backend can fallback to local SQLite at `backend/.data/userdb.sqlite3`.
- To require PostgreSQL and fail fast instead of fallback, set:

```bash
USER_DB_ALLOW_SQLITE_FALLBACK=false
```

### Market DB notes

- Primary market DB defaults to Timescale/PostgreSQL at `localhost:5433`.
- If unreachable, backend can fallback to local SQLite at `backend/.data/timescaledb.sqlite3`.
- To require Timescale and fail fast instead of fallback, set:

```bash
TIMESCALE_DB_ALLOW_SQLITE_FALLBACK=false
```
