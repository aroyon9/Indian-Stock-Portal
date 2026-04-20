from __future__ import annotations

import datetime as dt
import os
import random

from dotenv import load_dotenv
import psycopg


def get_timescale_dsn() -> str:
    dsn = os.getenv("TIMESCALE_DATABASE_URL")
    if dsn:
        return dsn

    user = os.getenv("TIMESCALE_USER", "timescale")
    password = os.getenv("TIMESCALE_PASSWORD", "timescale_password")
    db = os.getenv("TIMESCALE_DB", "portal_pricedb")
    host = os.getenv("TIMESCALE_HOST", "localhost")
    port = int(os.getenv("TIMESCALE_PORT", "5433"))
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


def gen_candles(start: dt.datetime, days: int, start_price: float) -> list[tuple]:
    price = start_price
    rows: list[tuple] = []
    for i in range(days):
        t = start + dt.timedelta(days=i)
        open_ = price
        high = open_ * (1 + random.uniform(0, 0.03))
        low = open_ * (1 - random.uniform(0, 0.03))
        close = random.uniform(low, high)
        volume = random.uniform(1_000_000, 20_000_000)
        price = close
        rows.append((t, open_, high, low, close, volume))
    return rows


def main() -> None:
    load_dotenv()
    dsn = get_timescale_dsn()
    now = dt.datetime.now(dt.UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - dt.timedelta(days=120)

    symbols = {
        "RELIANCE": 2900.0,
        "TCS": 4100.0,
        "INFY": 1800.0,
    }

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for symbol, start_price in symbols.items():
                cur.execute(
                    "insert into symbols(symbol, name) values (%s, %s) on conflict (symbol) do nothing",
                    (symbol, symbol),
                )
                candles = gen_candles(start, 120, start_price)
                cur.executemany(
                    """
                    insert into ohlcv(time, symbol, open, high, low, close, volume)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    on conflict (time, symbol) do nothing
                    """,
                    [(t, symbol, o, h, l, c, v) for (t, o, h, l, c, v) in candles],
                )

        conn.commit()

    print("Inserted sample OHLCV into TimescaleDB.")


if __name__ == "__main__":
    main()

