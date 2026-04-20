from __future__ import annotations

import datetime as dt
import csv
import io
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.timescale_db import get_timescale_db
from app.schemas.market import OhlcvOut, SymbolOut, ScreenerOut, AnalyticsOut, IndexOut
from app.services import screener_service

router = APIRouter()


_INDICES_CACHE: tuple[dt.datetime, list[IndexOut]] | None = None
_INDICES_CACHE_TTL_SECONDS = 15
_INDEX_MEMBERS_CACHE: dict[str, tuple[dt.datetime, list[str]]] = {}
_INDEX_MEMBERS_TTL_SECONDS = 60 * 60 * 6
_LIVE_QUOTES_CACHE: dict[str, tuple[dt.datetime, dict[str, float | dt.datetime | None]]] = {}
_LIVE_QUOTES_CACHE_TTL_SECONDS = 60

_INDEX_DEFINITIONS: dict[str, dict[str, str]] = {
    "all": {"label": "All NSE"},
    "nifty50": {
        "label": "Nifty 50",
        "csv": "https://archives.nseindia.com/content/indices/ind_nifty50list.csv",
    },
    "niftynext50": {
        "label": "Nifty Next 50",
        "csv": "https://archives.nseindia.com/content/indices/ind_niftynext50list.csv",
    },
    "niftymidcap150": {
        "label": "Nifty Midcap 150",
        "csv": "https://archives.nseindia.com/content/indices/ind_niftymidcap150list.csv",
    },
    "niftysmallcap250": {
        "label": "Nifty Smallcap 250",
        "csv": "https://archives.nseindia.com/content/indices/ind_niftysmallcap250list.csv",
    },
    "nifty500": {
        "label": "Nifty 500",
        "csv": "https://archives.nseindia.com/content/indices/ind_nifty500list.csv",
    },
}

_LOCAL_INDEX_FALLBACKS: dict[str, list[str]] = {
    "nifty50": [
        "RELIANCE", "TCS", "HDFCBANK", "BHARTIARTL", "ICICIBANK", "SBIN", "INFY", "ITC", "LT", "HINDUNILVR",
        "KOTAKBANK", "AXISBANK", "BAJFINANCE", "ASIANPAINT", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NESTLEIND", "POWERGRID",
        "NTPC", "ONGC", "TMPV", "M&M", "TATASTEEL", "WIPRO", "TECHM", "ADANIPORTS", "HCLTECH", "BAJAJFINSV",
        "JSWSTEEL", "HINDALCO", "COALINDIA", "GRASIM", "INDUSINDBK", "ADANIENT", "CIPLA", "DRREDDY", "BRITANNIA", "EICHERMOT",
        "HEROMOTOCO", "APOLLOHOSP", "BPCL", "DIVISLAB", "SHRIRAMFIN", "TATACONSUM", "BAJAJ-AUTO", "TRENT", "BEL", "ABBOTINDIA",
    ],
    "niftynext50": [
        "DMART", "HAL", "SIEMENS", "VBL", "PIDILITIND", "DABUR", "BANKBARODA", "INDIGO", "ADANIENSOL", "TVSMOTOR",
        "ABB", "PFC", "LODHA", "GODREJCP", "HDFCLIFE", "SBILIFE", "ICICIPRULI", "NAUKRI", "BAJAJHLDNG", "TORNTPHARM",
        "AMBUJACEM", "MCDOWELL-N", "PNB", "INDUSTOWER", "HAVELLS", "ICICIGI", "MOTHERSON", "ZYDUSLIFE", "BERGEPAINT", "DLF",
        "BOSCHLTD", "CHOLAFIN", "SHREECEM", "COLPAL", "MARICO", "PGHH", "LUPIN", "UNIONBANK", "GAIL", "IOC",
        "RECLTD", "SAMVARDHANA", "CANBK", "HINDPETRO", "AUBANK", "INDHOTEL", "MUTHOOTFIN", "ABBOTINDIA", "SRF", "ACC",
    ],
    "niftymidcap150": [
        "BSE", "MAXHEALTH", "PAYTM", "PRESTIGE", "POLYCAB", "APLAPOLLO", "AUROPHARMA", "COFORGE", "PERSISTENT", "MPHASIS",
        "LTIM", "SUPREMEIND", "DIXON", "INDIANB", "YESBANK", "FEDERALBNK", "IDFCFIRSTB", "ASHOKLEY", "BHARATFORG", "CONCOR",
        "CUMMINSIND", "ESCORTS", "JINDALSTEL", "LTF", "MRF", "OBEROIRLTY", "PAGEIND", "PETRONET", "SAIL", "SUNTV",
        "TATAPOWER", "TIINDIA", "TORNTPOWER", "UPL", "VEDL", "VOLTAS", "ZEEL", "BIOCON", "NHPC", "NMDC",
        "IRCTC", "INDIAMART", "JSWENERGY", "KPITTECH", "MANKIND", "SOLARINDS", "TATATECH", "UNOMINDA", "TUBEINVEST", "ABCAPITAL",
    ],
    "niftysmallcap250": [
        "AFFLE", "ANGELONE", "BLS", "CDSL", "CENTURYPLY", "CLEAN", "CYIENT", "DEEPAKNTR", "FSL", "FINEORG",
        "HAPPSTMNDS", "IEX", "IRB", "JUBLFOOD", "KALYANKJIL", "LAURUSLABS", "MAZDOCK", "NAVINFLUOR", "RAINBOW", "RITES",
        "ROUTE", "RVNL", "SONACOMS", "SUZLON", "TANLA", "TRITURBINE", "UJJIVANSFB", "VGUARD", "WHIRLPOOL", "ZYDUSWELL",
        "AARTIIND", "ABFRL", "BATAINDIA", "BLUESTARCO", "CAMS", "CESC", "CHAMBLFERT", "EIDPARRY", "ELGIEQUIP", "ENDURANCE",
        "EPL", "FINPIPE", "GRAPHITE", "GRINDWELL", "HFCL", "JKCEMENT", "KEI", "KFINTECH", "LATENTVIEW", "POLYMED",
    ],
}
_LOCAL_INDEX_FALLBACKS["nifty500"] = list(
    dict.fromkeys(
        _LOCAL_INDEX_FALLBACKS["nifty50"]
        + _LOCAL_INDEX_FALLBACKS["niftynext50"]
        + _LOCAL_INDEX_FALLBACKS["niftymidcap150"]
        + _LOCAL_INDEX_FALLBACKS["niftysmallcap250"]
    )
)


def _to_float(value: object | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "").strip())
        except Exception:
            return None
    return None


def _safe_symbol(raw: str) -> str:
    return raw.strip().upper().replace(".NS", "")


def _market_data_symbol(raw: str) -> str:
    safe_symbol = _safe_symbol(raw)
    if safe_symbol == "NIFTY 50":
        return "^NSEI"
    if safe_symbol == "SENSEX":
        return "^BSESN"
    return f"{safe_symbol}.NS"


def _resolve_index_alias(raw: str) -> tuple[str, str] | None:
    safe_symbol = _safe_symbol(raw)
    normalized = safe_symbol.replace(" ", "")
    if normalized in {"NIFTY50", "NIFTY", "^NSEI", "NSEI"}:
        return "NIFTY 50", "^NSEI"
    if normalized in {"SENSEX", "^BSESN", "BSESN"}:
        return "SENSEX", "^BSESN"
    return None


def _load_local_nse_universe() -> list[tuple[str, str | None]]:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[5] / "frontend" / "public" / "symbols.json",
        here.parents[4] / "frontend" / "public" / "symbols.json",
        Path.cwd() / "frontend" / "public" / "symbols.json",
    ]
    for path in candidates:
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            out: list[tuple[str, str | None]] = []
            for row in payload:
                if not isinstance(row, dict):
                    continue
                symbol = _safe_symbol(str(row.get("symbol") or ""))
                if not symbol:
                    continue
                name = row.get("name")
                out.append((symbol, str(name).strip() if isinstance(name, str) and name.strip() else None))
            if out:
                return out
        except Exception:
            continue
    return []


def _bootstrap_symbols_if_needed(db: Session) -> None:
    count_row = db.execute(text("SELECT COUNT(*) AS c FROM symbols")).first()
    count = int(count_row.c or 0) if count_row else 0
    if count >= 1000:
        return

    universe = _load_local_nse_universe()
    if not universe:
        return

    rows = [{"symbol": symbol, "name": name} for symbol, name in universe]
    db.execute(
        text(
            """
            INSERT INTO symbols(symbol, name)
            VALUES (:symbol, :name)
            ON CONFLICT (symbol) DO UPDATE
            SET name = COALESCE(EXCLUDED.name, symbols.name)
            """
        ),
        rows,
    )
    db.commit()


def _fetch_index_constituents(index_key: str) -> list[str]:
    key = (index_key or "all").strip().lower()
    if key == "all":
        return []

    local_symbols = _LOCAL_INDEX_FALLBACKS.get(key)
    if local_symbols:
        return local_symbols

    cfg = _INDEX_DEFINITIONS.get(key)
    if not cfg:
        return []

    now = dt.datetime.now(dt.timezone.utc)
    cached = _INDEX_MEMBERS_CACHE.get(key)
    if cached and (now - cached[0]).total_seconds() < _INDEX_MEMBERS_TTL_SECONDS:
        return cached[1]

    url = cfg.get("csv")
    if not url:
        return []

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/csv,application/csv,text/plain,*/*",
        },
        method="GET",
    )
    symbols: list[str] = []
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = resp.read().decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(payload))
        for row in reader:
            sym_raw = (row.get("Symbol") or row.get("SYMBOL") or "").strip()
            if not sym_raw:
                continue
            symbols.append(_safe_symbol(sym_raw))
    except Exception:
        symbols = []

    deduped = list(dict.fromkeys(symbols))
    _INDEX_MEMBERS_CACHE[key] = (now, deduped)
    return deduped


def _chunk(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def _get_cached_quote_snapshots(
    symbols: list[str],
    max_age_seconds: int = _LIVE_QUOTES_CACHE_TTL_SECONDS,
) -> tuple[dict[str, dict[str, float | dt.datetime | None]], list[str]]:
    now = dt.datetime.now(dt.timezone.utc)
    cached: dict[str, dict[str, float | dt.datetime | None]] = {}
    missing: list[str] = []

    for symbol in symbols:
        entry = _LIVE_QUOTES_CACHE.get(symbol)
        if not entry:
            missing.append(symbol)
            continue
        fetched_at, snapshot = entry
        if (now - fetched_at).total_seconds() > max_age_seconds:
            missing.append(symbol)
            continue
        cached[symbol] = snapshot

    return cached, missing


def _store_cached_quote_snapshots(snapshots: dict[str, dict[str, float | dt.datetime | None]]) -> None:
    if not snapshots:
        return
    now = dt.datetime.now(dt.timezone.utc)
    for symbol, snapshot in snapshots.items():
        _LIVE_QUOTES_CACHE[symbol] = (now, snapshot)


def _apply_symbol_scope(
    sql: str,
    params: dict[str, object],
    symbols: list[str],
    column_name: str = "sc.symbol",
) -> str:
    if not symbols:
        return sql
    placeholders: list[str] = []
    for i, sym in enumerate(symbols):
        key = f"idx_sym_{i}"
        placeholders.append(f":{key}")
        params[key] = sym
    return sql + f"\n          AND {column_name} IN ({', '.join(placeholders)})\n"


def _calc_rsi(series, period: int = 14):
    delta = series.diff()
    up = delta.clip(lower=0)
    down = -delta.clip(upper=0)
    avg_gain = up.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = down.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _scan_breakouts_live(
    symbols: list[str],
    symbol_name_map: dict[str, str | None],
    index_key: str,
    rsi_min: float,
    rsi_max: float,
    change_min: float,
    breakout_only: bool,
    limit: int,
) -> list[ScreenerOut]:
    try:
        import yfinance as yf
        import pandas as pd
    except Exception:
        return []
    _configure_yfinance_cache(yf)

    if not symbols:
        return []

    out: list[ScreenerOut] = []
    for group in _chunk(symbols[:400], 90):
        tickers = [f"{s}.NS" for s in group]
        try:
            hist = yf.download(
                tickers=tickers,
                period="1y",
                interval="1d",
                auto_adjust=False,
                progress=False,
                group_by="ticker",
                threads=True,
            )
        except Exception:
            continue
        if hist is None or len(hist) == 0:
            continue

        for sym in group:
            key = f"{sym}.NS"
            try:
                df = hist[key].dropna(subset=["Close"]) if isinstance(hist.columns, pd.MultiIndex) else hist
                if df is None or len(df) < 220:
                    continue
                close = df["Close"].astype(float)
                volume = df["Volume"].astype(float).fillna(0.0)

                rsi_series = _calc_rsi(close, 14)
                rsi = float(rsi_series.iloc[-1]) if len(rsi_series) else None
                ema_20 = float(close.ewm(span=20, adjust=False).mean().iloc[-1])
                ema_50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])
                ema_200 = float(close.ewm(span=200, adjust=False).mean().iloc[-1])
                macd_fast = close.ewm(span=12, adjust=False).mean()
                macd_slow = close.ewm(span=26, adjust=False).mean()
                macd = float((macd_fast - macd_slow).iloc[-1])

                change_1d = float((close.iloc[-1] / close.iloc[-2] - 1) * 100.0)
                change_5d = float((close.iloc[-1] / close.iloc[-6] - 1) * 100.0)
                change_1m = float((close.iloc[-1] / close.iloc[-21] - 1) * 100.0)

                prev_20d_high = float(close.iloc[-21:-1].max())
                vol_ratio = float(volume.iloc[-1] / max(volume.iloc[-21:-1].mean(), 1.0))
                is_breakout = close.iloc[-1] > prev_20d_high
                trend_ok = ema_20 > ema_50 >= ema_200
                momentum_ok = (rsi is not None and rsi_min <= rsi <= rsi_max and change_1d >= change_min and macd > 0)
                breakout_flag = bool(is_breakout and trend_ok and momentum_ok)
                if breakout_only and not breakout_flag:
                    continue

                breakout_score = (
                    (3.0 if is_breakout else 0.0)
                    + (2.0 if trend_ok else 0.0)
                    + max(min(change_1d, 8.0), -8.0) * 0.5
                    + max(min(change_5d, 15.0), -15.0) * 0.25
                    + max(min((rsi or 50.0) - 50.0, 25.0), -25.0) * 0.08
                    + min(vol_ratio, 3.0) * 0.8
                )

                out.append(
                    ScreenerOut(
                        symbol=sym,
                        name=symbol_name_map.get(sym),
                        current_price=float(close.iloc[-1]),
                        rsi=rsi,
                        macd=macd,
                        change_1d=change_1d,
                        change_5d=change_5d,
                        change_1m=change_1m,
                        ema_20=ema_20,
                        ema_50=ema_50,
                        ema_200=ema_200,
                        volume_ratio=vol_ratio,
                        is_breakout=breakout_flag,
                        breakout_score=breakout_score,
                        index_buckets=[index_key],
                        last_updated=dt.datetime.now(dt.timezone.utc),
                    )
                )
            except Exception:
                continue

        if len(out) >= max(25, limit):
            break

    out.sort(key=lambda x: (x.breakout_score or -9999.0), reverse=True)
    return out[:limit]


def _fetch_yahoo_quotes(symbols: list[str]) -> dict[str, dict]:
    url = "https://query1.finance.yahoo.com/v7/finance/quote?" + urllib.parse.urlencode(
        {"symbols": ",".join(symbols)}
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=4) as resp:
        payload = resp.read()

    data = json.loads(payload.decode("utf-8"))
    results = data.get("quoteResponse", {}).get("result", []) or []
    return {r.get("symbol"): r for r in results if isinstance(r, dict) and r.get("symbol")}


def _fetch_yahoo_quote_snapshots(symbols: list[str]) -> dict[str, dict[str, float | dt.datetime | None]]:
    unique_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))
    if not unique_symbols:
        return {}

    cached, pending = _get_cached_quote_snapshots(unique_symbols)
    out: dict[str, dict[str, float | dt.datetime | None]] = dict(cached)
    if not pending:
        return out

    fetched: dict[str, dict[str, float | dt.datetime | None]] = {}
    for group in _chunk(pending, 25):
        yahoo_symbols = [f"{symbol}.NS" for symbol in group]
        try:
            quotes = _fetch_yahoo_quotes(yahoo_symbols)
        except Exception:
            quotes = {}

        for symbol in group:
            quote = quotes.get(f"{symbol}.NS") or quotes.get(symbol)
            if not quote:
                continue

            current_price = _to_float(
                quote.get("regularMarketPrice")
                or quote.get("postMarketPrice")
                or quote.get("preMarketPrice")
                or quote.get("regularMarketPreviousClose")
                or quote.get("previousClose")
            )
            previous_close = _to_float(
                quote.get("regularMarketPreviousClose")
                or quote.get("previousClose")
            )
            open_price = _to_float(
                quote.get("regularMarketOpen")
                or quote.get("regularMarketPreviousClose")
                or quote.get("previousClose")
            )
            high = _to_float(quote.get("regularMarketDayHigh"))
            low = _to_float(quote.get("regularMarketDayLow"))
            volume = _to_float(quote.get("regularMarketVolume")) or 0.0
            market_time = quote.get("regularMarketTime")

            if current_price is None:
                continue

            change_pct = None
            if previous_close not in (None, 0):
                change_pct = ((current_price - previous_close) / previous_close) * 100.0

            ts = None
            if isinstance(market_time, (int, float)):
                try:
                    ts = dt.datetime.fromtimestamp(int(market_time), tz=dt.timezone.utc)
                except Exception:
                    ts = None

            fetched[symbol] = {
                "current_price": float(current_price),
                "change_pct": float(change_pct) if change_pct is not None else None,
                "open": float(open_price if open_price is not None else current_price),
                "high": float(high if high is not None else current_price),
                "low": float(low if low is not None else current_price),
                "close": float(current_price),
                "volume": float(volume),
                "time": ts,
            }

    _store_cached_quote_snapshots(fetched)
    out.update(fetched)
    return out


def _fetch_nse_index_quote(index_name: str) -> tuple[float | None, float | None, float | None]:
    """
    Fetch index quote from NSE (best-effort).

    Returns: (current_price, day_change, day_change_pct)
    """
    from nsepython import nse_get_index_quote  # type: ignore

    q = nse_get_index_quote(index_name) or {}

    curr = _to_float(
        q.get("last")
        or q.get("lastPrice")
        or q.get("last_price")
        or q.get("ltp")
    )
    day_change = _to_float(q.get("change") or q.get("ch"))
    day_change_pct = _to_float(q.get("percChange") or q.get("pChange") or q.get("percentChange"))
    prev_close = _to_float(q.get("previousClose") or q.get("prevClose") or q.get("previous_close"))

    if day_change is None and curr is not None and prev_close is not None:
        day_change = curr - prev_close

    if day_change_pct is None and prev_close is not None and prev_close != 0 and day_change is not None:
        day_change_pct = (day_change / prev_close) * 100.0

    return curr, day_change, day_change_pct


def _fetch_nse_stock_quote(symbol: str) -> tuple[float | None, float | None]:
    """
    Best-effort NSE quote fallback for equities.

    Returns: (current_price, day_change_pct)
    """
    sym = _safe_symbol(symbol)
    if not sym:
        return None, None
    try:
        import nsepython as nse  # type: ignore
    except Exception:
        return None, None

    # Try rich quote payload first.
    try:
        q = nse.nse_eq(sym) or {}  # type: ignore[attr-defined]
        curr = _to_float(q.get("lastPrice") or q.get("last_price") or q.get("ltp"))
        pct = _to_float(q.get("pChange") or q.get("percentChange") or q.get("changePercent"))
        prev = _to_float(q.get("previousClose") or q.get("prevClose"))
        chg = _to_float(q.get("change"))
        if pct is None and chg is not None and prev not in (None, 0):
            pct = (chg / prev) * 100.0
        if curr is not None:
            return curr, pct
    except Exception:
        pass

    # Fallback to LTP API style.
    try:
        ltp_payload = nse.nse_quote_ltp(sym)  # type: ignore[attr-defined]
        if isinstance(ltp_payload, dict):
            curr = _to_float(
                ltp_payload.get("lastPrice")
                or ltp_payload.get("ltp")
                or ltp_payload.get("price")
            )
            pct = _to_float(ltp_payload.get("pChange") or ltp_payload.get("percentChange"))
            if curr is not None:
                return curr, pct
        curr = _to_float(ltp_payload)
        if curr is not None:
            return curr, None
    except Exception:
        pass

    return None, None


def _fetch_yfinance_equity_snapshots(symbols: list[str]) -> dict[str, dict[str, float | dt.datetime | None]]:
    base_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))
    if not base_symbols:
        return {}

    out = _fetch_yahoo_quote_snapshots(base_symbols)
    missing = [symbol for symbol in base_symbols if symbol not in out]
    if not missing:
        return out

    fetched: dict[str, dict[str, float | dt.datetime | None]] = {}

    def fetch_one(symbol: str) -> tuple[str, dict[str, float | dt.datetime | None] | None]:
        url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{urllib.parse.quote(symbol)}.NS?range=7d&interval=1d&includePrePost=false"
        )
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            result = (((payload or {}).get("chart") or {}).get("result") or [None])[0] or {}
            meta = result.get("meta") or {}
            timestamps = result.get("timestamp") or []
            quote = (((result.get("indicators") or {}).get("quote") or [None])[0]) or {}
            closes = quote.get("close") or []
            opens = quote.get("open") or []
            highs = quote.get("high") or []
            lows = quote.get("low") or []
            volumes = quote.get("volume") or []

            valid_closes = [float(value) for value in closes if value is not None]
            current_price = _to_float(meta.get("regularMarketPrice"))
            if current_price is None and valid_closes:
                current_price = valid_closes[-1]
            if current_price is None:
                return symbol, None

            previous_close = _to_float(meta.get("previousClose"))
            if previous_close is None and len(valid_closes) >= 2:
                previous_close = valid_closes[-2]

            change_pct = None
            if previous_close not in (None, 0):
                change_pct = ((current_price - previous_close) / previous_close) * 100.0

            open_price = _to_float(meta.get("regularMarketOpen"))
            if open_price is None:
                open_price = _to_float(next((value for value in reversed(opens) if value is not None), None)) or current_price
            high = _to_float(meta.get("regularMarketDayHigh"))
            if high is None:
                high = _to_float(next((value for value in reversed(highs) if value is not None), None)) or max(open_price, current_price)
            low = _to_float(meta.get("regularMarketDayLow"))
            if low is None:
                low = _to_float(next((value for value in reversed(lows) if value is not None), None)) or min(open_price, current_price)
            volume = _to_float(next((value for value in reversed(volumes) if value is not None), None)) or 0.0

            ts = None
            if timestamps:
                try:
                    ts = dt.datetime.fromtimestamp(int(timestamps[-1]), tz=dt.timezone.utc)
                except Exception:
                    ts = None

            return symbol, {
                "current_price": float(current_price),
                "change_pct": float(change_pct) if change_pct is not None else None,
                "open": float(open_price),
                "high": float(high),
                "low": float(low),
                "close": float(current_price),
                "volume": float(volume),
                "time": ts,
            }
        except Exception:
            return symbol, None

    with ThreadPoolExecutor(max_workers=min(8, max(1, len(missing)))) as pool:
        futures = [pool.submit(fetch_one, symbol) for symbol in missing]
        for future in as_completed(futures):
            symbol, snapshot = future.result()
            if snapshot is not None:
                fetched[symbol] = snapshot

    _store_cached_quote_snapshots(fetched)
    out.update(fetched)

    # Final fallback: NSE quotes for any symbols still missing from Yahoo.
    nse_missing = [symbol for symbol in base_symbols if symbol not in out]
    if nse_missing:
        nse_fetched: dict[str, dict[str, float | dt.datetime | None]] = {}
        now = dt.datetime.now(dt.timezone.utc)
        for symbol in nse_missing:
            curr, pct = _fetch_nse_stock_quote(symbol)
            if curr is None:
                continue
            nse_fetched[symbol] = {
                "current_price": float(curr),
                "change_pct": float(pct) if pct is not None else None,
                "open": float(curr),
                "high": float(curr),
                "low": float(curr),
                "close": float(curr),
                "volume": 0.0,
                "time": now,
            }
        _store_cached_quote_snapshots(nse_fetched)
        out.update(nse_fetched)

    return out


def _enrich_symbols_with_live_quotes(symbols: list[SymbolOut], cap: int = 120) -> list[SymbolOut]:
    """
    Best-effort enrichment for stock cards when DB OHLCV is missing/stale.
    """
    if not symbols:
        return symbols

    targets = [s for s in symbols if s.current_price is None][: max(1, cap)]
    if not targets:
        return symbols

    by_symbol = {s.symbol: s for s in symbols}
    snapshots = _fetch_yfinance_equity_snapshots([s.symbol for s in targets])
    for symbol, snapshot in snapshots.items():
        row = by_symbol.get(symbol)
        if row is None:
            continue
        curr = _to_float(snapshot.get("current_price"))
        pct = _to_float(snapshot.get("change_pct"))
        if curr is not None:
            row.current_price = curr
        if pct is not None:
            row.change_pct = pct

    return symbols


def _persist_symbol_snapshots(db: Session, snapshots: dict[str, dict[str, float | dt.datetime | None]]) -> None:
    if not snapshots:
        return
    rows: list[dict[str, object]] = []
    for symbol, snapshot in snapshots.items():
        close = _to_float(snapshot.get("close") or snapshot.get("current_price"))
        if close is None:
            continue
        ts = snapshot.get("time")
        now = ts if isinstance(ts, dt.datetime) else dt.datetime.now(dt.timezone.utc)
        now = now.replace(second=0, microsecond=0)
        open_price = _to_float(snapshot.get("open")) or close
        high = _to_float(snapshot.get("high")) or max(open_price, close)
        low = _to_float(snapshot.get("low")) or min(open_price, close)
        volume = _to_float(snapshot.get("volume")) or 0.0
        rows.append(
            {
                "time": now,
                "symbol": symbol,
                "open": float(open_price),
                "high": float(high),
                "low": float(low),
                "close": float(close),
                "volume": float(volume),
            }
        )

    if not rows:
        return

    try:
        db.execute(
            text(
                """
                INSERT INTO ohlcv(time, symbol, open, high, low, close, volume)
                VALUES (:time, :symbol, :open, :high, :low, :close, :volume)
                ON CONFLICT (time, symbol) DO UPDATE
                SET open = EXCLUDED.open,
                    high = GREATEST(ohlcv.high, EXCLUDED.high),
                    low = LEAST(ohlcv.low, EXCLUDED.low),
                    close = EXCLUDED.close,
                    volume = COALESCE(EXCLUDED.volume, ohlcv.volume)
                """
            ),
            rows,
        )
        db.commit()
    except Exception:
        db.rollback()


def _persist_ohlcv_rows(db: Session, symbol: str, rows: list[OhlcvOut]) -> None:
    if not rows:
        return
    safe_symbol = _safe_symbol(symbol)
    payload = [
        {
            "time": row.time,
            "symbol": safe_symbol,
            "open": float(row.open),
            "high": float(row.high),
            "low": float(row.low),
            "close": float(row.close),
            "volume": float(row.volume),
        }
        for row in rows
    ]
    try:
        db.execute(
            text(
                """
                INSERT INTO ohlcv(time, symbol, open, high, low, close, volume)
                VALUES (:time, :symbol, :open, :high, :low, :close, :volume)
                ON CONFLICT (time, symbol) DO UPDATE
                SET open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
                """
            ),
            payload,
        )
        db.commit()
    except Exception:
        db.rollback()


def _refresh_symbol_prices(db: Session, symbols: list[str]) -> dict[str, SymbolOut]:
    unique_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))
    if not unique_symbols:
        return {}
    snapshots = _fetch_yfinance_equity_snapshots(unique_symbols)
    _persist_symbol_snapshots(db, snapshots)
    out: dict[str, SymbolOut] = {}
    for symbol in unique_symbols:
        snapshot = snapshots.get(symbol)
        out[symbol] = SymbolOut(
            symbol=symbol,
            name=None,
            current_price=_to_float(snapshot.get("current_price")) if snapshot else None,
            change_pct=_to_float(snapshot.get("change_pct")) if snapshot else None,
        )
    return out


def _compute_breakout_score(
    change_1d: float | None,
    change_5d: float | None,
    rsi: float | None,
    ema_20: float | None,
    ema_50: float | None,
    ema_200: float | None,
    macd: float | None,
) -> float:
    return (
        (change_1d or 0.0) * 0.6
        + (change_5d or 0.0) * 0.3
        + (((rsi if rsi is not None else 50.0) - 50.0) * 0.08)
        + (1.2 if ema_20 is not None and ema_50 is not None and ema_20 > ema_50 else 0.0)
        + (1.2 if ema_50 is not None and ema_200 is not None and ema_50 >= ema_200 else 0.0)
        + (1.0 if macd is not None and macd > 0 else 0.0)
    )


def _passes_breakout_filters(
    rsi: float | None,
    change_1d: float | None,
    ema_20: float | None,
    ema_50: float | None,
    ema_200: float | None,
    macd: float | None,
    *,
    rsi_min: float,
    rsi_max: float,
    change_min: float,
) -> bool:
    return (
        change_1d is not None
        and change_1d >= change_min
        and rsi is not None
        and rsi_min <= rsi <= rsi_max
        and ema_20 is not None
        and ema_50 is not None
        and ema_20 > ema_50
        and ema_200 is not None
        and ema_50 >= ema_200
        and macd is not None
        and macd > 0
    )


def _passes_screener_range_filters(
    rsi: float | None,
    change_1d: float | None,
    *,
    rsi_min: float,
    rsi_max: float,
    change_min: float,
) -> bool:
    return (
        rsi is not None
        and change_1d is not None
        and rsi_min <= rsi <= rsi_max
        and change_1d >= change_min
    )


def _fetch_screener_metrics(
    db: Session,
    symbols: list[str],
    *,
    rsi_min: float,
    rsi_max: float,
    change_min: float,
) -> dict[str, ScreenerOut]:
    scoped_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))
    if not scoped_symbols:
        return {}

    params: dict[str, object] = {}
    sql = """
        SELECT
            symbol,
            rsi,
            macd,
            change_1d,
            change_5d,
            change_1m,
            ema_20,
            ema_50,
            ema_200,
            pe_ratio,
            roe,
            last_updated
        FROM screener
        WHERE 1 = 1
    """
    sql = _apply_symbol_scope(sql, params, scoped_symbols, column_name="symbol")

    try:
        rows = db.execute(text(sql), params).all()
    except Exception:
        return {}

    out: dict[str, ScreenerOut] = {}
    for row in rows:
        symbol = _safe_symbol(str(row.symbol))
        rsi = float(row.rsi) if row.rsi is not None else None
        macd = float(row.macd) if row.macd is not None else None
        change_1d = float(row.change_1d) if row.change_1d is not None else None
        change_5d = float(row.change_5d) if row.change_5d is not None else None
        ema_20 = float(row.ema_20) if row.ema_20 is not None else None
        ema_50 = float(row.ema_50) if row.ema_50 is not None else None
        ema_200 = float(row.ema_200) if row.ema_200 is not None else None
        out[symbol] = ScreenerOut(
            symbol=symbol,
            rsi=rsi,
            macd=macd,
            change_1d=change_1d,
            change_5d=float(row.change_5d) if row.change_5d is not None else None,
            change_1m=float(row.change_1m) if row.change_1m is not None else None,
            ema_20=ema_20,
            ema_50=ema_50,
            ema_200=ema_200,
            pe_ratio=float(row.pe_ratio) if row.pe_ratio is not None else None,
            roe=float(row.roe) if row.roe is not None else None,
            is_breakout=_passes_breakout_filters(
                rsi,
                change_1d,
                ema_20,
                ema_50,
                ema_200,
                macd,
                rsi_min=rsi_min,
                rsi_max=rsi_max,
                change_min=change_min,
            ),
            breakout_score=_compute_breakout_score(
                change_1d,
                change_5d,
                rsi,
                ema_20,
                ema_50,
                ema_200,
                macd,
            ),
            last_updated=row.last_updated,
        )
    return out


def _fetch_latest_price_snapshots(
    db: Session,
    symbols: list[str],
) -> dict[str, tuple[float | None, dt.datetime | None]]:
    scoped_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))
    if not scoped_symbols:
        return {}

    params: dict[str, object] = {}
    sql = """
        SELECT DISTINCT ON (symbol) symbol, close, time
        FROM ohlcv
        WHERE 1 = 1
    """
    sql = _apply_symbol_scope(sql, params, scoped_symbols, column_name="symbol")
    sql += "\n ORDER BY symbol, time DESC"

    try:
        rows = db.execute(text(sql), params).all()
    except Exception:
        return {}

    out: dict[str, tuple[float | None, dt.datetime | None]] = {}
    for row in rows:
        out[_safe_symbol(str(row.symbol))] = (
            float(row.close) if row.close is not None else None,
            row.time,
        )
    return out


def _build_live_screener_rows(
    symbols: list[str],
    *,
    symbol_name_map: dict[str, str | None],
    index_key: str,
    limit: int,
    metrics_map: dict[str, ScreenerOut] | None = None,
) -> list[ScreenerOut]:
    scoped_symbols = list(dict.fromkeys([_safe_symbol(symbol) for symbol in symbols if _safe_symbol(symbol)]))[:limit]
    if not scoped_symbols:
        return []

    snapshots = _fetch_yfinance_equity_snapshots(scoped_symbols)
    now = dt.datetime.now(dt.timezone.utc)
    rows: list[ScreenerOut] = []
    for symbol in scoped_symbols:
        snapshot = snapshots.get(symbol) or {}
        metrics = (metrics_map or {}).get(symbol)
        current_price = _to_float(snapshot.get("current_price"))
        change_pct = _to_float(snapshot.get("change_pct"))
        rows.append(
            ScreenerOut(
                symbol=symbol,
                name=symbol_name_map.get(symbol),
                current_price=float(current_price) if current_price is not None else None,
                rsi=metrics.rsi if metrics else None,
                macd=metrics.macd if metrics else None,
                change_1d=float(change_pct) if change_pct is not None else (metrics.change_1d if metrics else None),
                change_5d=metrics.change_5d if metrics else None,
                change_1m=metrics.change_1m if metrics else None,
                pe_ratio=metrics.pe_ratio if metrics else None,
                roe=metrics.roe if metrics else None,
                ema_20=metrics.ema_20 if metrics else None,
                ema_50=metrics.ema_50 if metrics else None,
                ema_200=metrics.ema_200 if metrics else None,
                is_breakout=metrics.is_breakout if metrics else None,
                breakout_score=metrics.breakout_score if metrics else None,
                index_buckets=[index_key],
                last_updated=metrics.last_updated if metrics and metrics.last_updated is not None else now,
            )
        )
    return rows


def _fetch_yfinance_index_quote(
    yf_symbol: str,
) -> tuple[float | None, float | None, float | None, dt.datetime | None]:
    """
    Fetch latest daily close and day-over-day delta from yfinance history.

    Returns: (current_price, day_change, day_change_pct, last_updated_utc)
    """
    import yfinance as yf  # type: ignore
    _configure_yfinance_cache(yf)

    ticker = yf.Ticker(yf_symbol)

    intraday = ticker.history(period="1d", interval="1m")
    intraday_close = intraday["Close"].dropna() if intraday is not None and len(intraday) else None

    daily = ticker.history(period="7d", interval="1d")
    daily_close = daily["Close"].dropna() if daily is not None and len(daily) else None

    curr: float | None = None
    raw_ts = None

    # Prefer intraday value so cards reflect current market price.
    if intraday_close is not None and len(intraday_close):
        curr = float(intraday_close.iloc[-1])
        raw_ts = intraday_close.index[-1]
    elif daily_close is not None and len(daily_close):
        curr = float(daily_close.iloc[-1])
        raw_ts = daily_close.index[-1]
    else:
        return None, None, None, None

    prev_close: float | None = None
    if daily_close is not None and len(daily_close) >= 2:
        prev_close = float(daily_close.iloc[-2])

    day_change: float | None = None
    day_change_pct: float | None = None
    if curr is not None and prev_close is not None:
        day_change = curr - prev_close
        if prev_close != 0:
            day_change_pct = (day_change / prev_close) * 100.0

    last_updated: dt.datetime | None = None
    try:
        if isinstance(raw_ts, dt.datetime):
            last_updated = raw_ts if raw_ts.tzinfo else raw_ts.replace(tzinfo=dt.timezone.utc)
        else:
            # pandas.Timestamp path
            pydt = raw_ts.to_pydatetime()
            last_updated = pydt if pydt.tzinfo else pydt.replace(tzinfo=dt.timezone.utc)
    except Exception:
        last_updated = None

    return curr, day_change, day_change_pct, last_updated


def _configure_yfinance_cache(yf_module) -> None:
    """
    Ensure yfinance cache files are created in a writable project-local directory.
    """
    cache_dir = Path.cwd() / ".cache" / "yfinance"
    cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("YFINANCE_CACHE_DIR", str(cache_dir))
    try:
        yf_module.set_tz_cache_location(str(cache_dir))
    except Exception:
        pass


def _pick_history_range(start: dt.datetime | None, limit: int) -> str:
    if start is None:
        if limit >= 3000:
            return "max"
        if limit >= 1200:
            return "5y"
        if limit >= 400:
            return "1y"
        return "6mo"

    now = dt.datetime.now(dt.timezone.utc)
    if start.tzinfo is None:
        start = start.replace(tzinfo=dt.timezone.utc)
    age_days = max(1, (now - start).days)
    if age_days > 365 * 8:
        return "max"
    if age_days > 365 * 3:
        return "5y"
    if age_days > 365:
        return "2y"
    if age_days > 180:
        return "1y"
    return "6mo"


def _fetch_yahoo_chart_history(
    symbol: str,
    start: dt.datetime | None = None,
    end: dt.datetime | None = None,
    limit: int = 500,
) -> list[OhlcvOut]:
    safe_symbol = _safe_symbol(symbol)
    if not safe_symbol:
        return []
    market_symbol = _market_data_symbol(symbol)

    range_key = _pick_history_range(start, limit)
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(market_symbol)}?range={urllib.parse.quote(range_key)}&interval=1d&includePrePost=false"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
        method="GET",
    )

    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    result = (((payload or {}).get("chart") or {}).get("result") or [None])[0] or {}
    timestamps = result.get("timestamp") or []
    quote = (((result.get("indicators") or {}).get("quote") or [None])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    rows: list[OhlcvOut] = []
    for idx, raw_ts in enumerate(timestamps):
        try:
            ts = dt.datetime.fromtimestamp(int(raw_ts), tz=dt.timezone.utc)
        except Exception:
            continue
        open_price = _to_float(opens[idx] if idx < len(opens) else None)
        high = _to_float(highs[idx] if idx < len(highs) else None)
        low = _to_float(lows[idx] if idx < len(lows) else None)
        close = _to_float(closes[idx] if idx < len(closes) else None)
        volume = _to_float(volumes[idx] if idx < len(volumes) else None) or 0.0
        if None in (open_price, high, low, close):
            continue
        if start is not None and ts < (start if start.tzinfo else start.replace(tzinfo=dt.timezone.utc)):
            continue
        if end is not None and ts > (end if end.tzinfo else end.replace(tzinfo=dt.timezone.utc)):
            continue
        rows.append(
            OhlcvOut(
                time=ts,
                open=float(open_price),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=float(volume),
            )
        )

    rows.sort(key=lambda row: row.time)
    if limit > 0:
        rows = rows[-limit:]
    return rows


def _fetch_yfinance_chart_history(
    symbol: str,
    start: dt.datetime | None = None,
    end: dt.datetime | None = None,
    limit: int = 500,
) -> list[OhlcvOut]:
    safe_symbol = _safe_symbol(symbol)
    if not safe_symbol:
        return []

    try:
        import yfinance as yf  # type: ignore
    except Exception:
        return []

    _configure_yfinance_cache(yf)
    ticker = yf.Ticker(_market_data_symbol(symbol))
    period = _pick_history_range(start, limit)

    try:
        hist = ticker.history(period=period, interval="1d", timeout=4)
    except Exception:
        return []
    if hist is None or len(hist) == 0:
        return []

    start_cmp = start if start is None or start.tzinfo else start.replace(tzinfo=dt.timezone.utc)
    end_cmp = end if end is None or end.tzinfo else end.replace(tzinfo=dt.timezone.utc)
    rows: list[OhlcvOut] = []
    for idx, row in hist.iterrows():
        try:
            ts = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
            if isinstance(ts, dt.datetime) and ts.tzinfo is None:
                ts = ts.replace(tzinfo=dt.timezone.utc)
            if start_cmp is not None and ts < start_cmp:
                continue
            if end_cmp is not None and ts > end_cmp:
                continue
            open_price = _to_float(row.get("Open"))
            high = _to_float(row.get("High"))
            low = _to_float(row.get("Low"))
            close = _to_float(row.get("Close"))
            volume = _to_float(row.get("Volume")) or 0.0
            if None in (open_price, high, low, close):
                continue
            rows.append(
                OhlcvOut(
                    time=ts,
                    open=float(open_price),
                    high=float(high),
                    low=float(low),
                    close=float(close),
                    volume=float(volume),
                )
            )
        except Exception:
            continue

    rows.sort(key=lambda item: item.time)
    if limit > 0:
        rows = rows[-limit:]
    return rows


def _fetch_yahoo_intraday_history(
    symbol: str,
    limit: int = 120,
) -> list[OhlcvOut]:
    safe_symbol = _safe_symbol(symbol)
    if not safe_symbol:
        return []
    market_symbol = _market_data_symbol(symbol)

    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(market_symbol)}?range=1d&interval=5m&includePrePost=false"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
        method="GET",
    )

    with urllib.request.urlopen(req, timeout=8) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    result = (((payload or {}).get("chart") or {}).get("result") or [None])[0] or {}
    timestamps = result.get("timestamp") or []
    quote = (((result.get("indicators") or {}).get("quote") or [None])[0]) or {}
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    rows: list[OhlcvOut] = []
    for idx, raw_ts in enumerate(timestamps):
        try:
            ts = dt.datetime.fromtimestamp(int(raw_ts), tz=dt.timezone.utc)
        except Exception:
            continue
        open_price = _to_float(opens[idx] if idx < len(opens) else None)
        high = _to_float(highs[idx] if idx < len(highs) else None)
        low = _to_float(lows[idx] if idx < len(lows) else None)
        close = _to_float(closes[idx] if idx < len(closes) else None)
        volume = _to_float(volumes[idx] if idx < len(volumes) else None) or 0.0
        if None in (open_price, high, low, close):
            continue
        rows.append(
            OhlcvOut(
                time=ts,
                open=float(open_price),
                high=float(high),
                low=float(low),
                close=float(close),
                volume=float(volume),
            )
        )

    rows.sort(key=lambda row: row.time)
    if limit > 0:
        rows = rows[-limit:]
    return rows


def _fetch_yfinance_intraday_history(
    symbol: str,
    limit: int = 120,
) -> list[OhlcvOut]:
    safe_symbol = _safe_symbol(symbol)
    if not safe_symbol:
        return []

    try:
        import yfinance as yf  # type: ignore
    except Exception:
        return []

    _configure_yfinance_cache(yf)
    ticker = yf.Ticker(_market_data_symbol(symbol))

    try:
        hist = ticker.history(period="1d", interval="5m", timeout=4)
    except Exception:
        return []
    if hist is None or len(hist) == 0:
        return []

    rows: list[OhlcvOut] = []
    for idx, row in hist.iterrows():
        try:
            ts = idx.to_pydatetime() if hasattr(idx, "to_pydatetime") else idx
            if isinstance(ts, dt.datetime) and ts.tzinfo is None:
                ts = ts.replace(tzinfo=dt.timezone.utc)
            open_price = _to_float(row.get("Open"))
            high = _to_float(row.get("High"))
            low = _to_float(row.get("Low"))
            close = _to_float(row.get("Close"))
            volume = _to_float(row.get("Volume")) or 0.0
            if None in (open_price, high, low, close):
                continue
            rows.append(
                OhlcvOut(
                    time=ts,
                    open=float(open_price),
                    high=float(high),
                    low=float(low),
                    close=float(close),
                    volume=float(volume),
                )
            )
        except Exception:
            continue

    rows.sort(key=lambda item: item.time)
    if limit > 0:
        rows = rows[-limit:]
    return rows


@router.get("/indices", response_model=list[IndexOut])
def get_indices(response: Response) -> list[IndexOut]:
    """
    Live index quotes for key Indian benchmarks.

    Source: Yahoo Finance quote endpoint (fast, intraday) with yfinance fallback.
    """
    response.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    indices = [
        ("NIFTY 50", "^NSEI"),
        ("SENSEX", "^BSESN"),
    ]

    global _INDICES_CACHE
    now = dt.datetime.now(dt.timezone.utc)
    if _INDICES_CACHE is not None:
        cached_at, cached = _INDICES_CACHE
        if (now - cached_at).total_seconds() < _INDICES_CACHE_TTL_SECONDS:
            return cached

    provider = (settings.indices_provider or "auto").strip().lower()
    prefer_nse_for_nifty = provider in {"auto", "nse_yahoo"}
    out: list[IndexOut] = []
    yahoo_quotes: dict[str, dict] = {}

    try:
        yahoo_quotes = _fetch_yahoo_quotes([yf_sym for _, yf_sym in indices])
    except Exception:
        yahoo_quotes = {}

    for name, yf_sym in indices:
        curr: float | None = None
        day_change: float | None = None
        day_change_pct: float | None = None
        last_updated = now

        # Prefer Yahoo quote snapshot so price/change/prev-close come from the same tick.
        q = yahoo_quotes.get(yf_sym) or {}
        curr = _to_float(q.get("regularMarketPrice"))
        prev_close = _to_float(q.get("regularMarketPreviousClose"))
        day_change = _to_float(q.get("regularMarketChange"))
        day_change_pct = _to_float(q.get("regularMarketChangePercent"))
        ts = q.get("regularMarketTime")

        if day_change is None and curr is not None and prev_close is not None:
            day_change = curr - prev_close

        if day_change_pct is None and prev_close is not None and prev_close != 0 and day_change is not None:
            day_change_pct = (day_change / prev_close) * 100.0

        if ts is not None:
            try:
                last_updated = dt.datetime.fromtimestamp(int(ts), tz=dt.timezone.utc)
            except Exception:
                last_updated = now

        # Fallback to yfinance history only when quote endpoint is unavailable.
        try:
            if curr is None:
                curr, day_change, day_change_pct, yf_ts = _fetch_yfinance_index_quote(yf_sym)
                if yf_ts is not None:
                    last_updated = yf_ts
        except Exception:
            if curr is None:
                curr, day_change, day_change_pct = None, None, None

        # NSE fallback for NIFTY only when primary quote source is unavailable.
        if curr is None and prefer_nse_for_nifty and name == "NIFTY 50":
            try:
                nse_curr, nse_chg, nse_pct = _fetch_nse_index_quote("NIFTY 50")
                if nse_curr is not None:
                    curr = nse_curr
                    day_change = nse_chg
                    day_change_pct = nse_pct
                    last_updated = now
            except Exception:
                pass

        out.append(
            IndexOut(
                symbol=name,
                name=name,
                current_price=curr,
                day_change=day_change,
                day_change_pct=day_change_pct,
                last_updated=last_updated,
            )
        )

    _INDICES_CACHE = (now, out)
    return out

@router.post("/screener/refresh")
def refresh_screener(db: Session = Depends(get_timescale_db)):
    screener_service.refresh_screener_data(db)
    return {"status": "ok"}


@router.get("/screener-metrics", response_model=list[ScreenerOut])
def get_screener_metrics(
    symbols: str = Query(default=""),
    index_key: str = Query(default="all"),
    rsi_min: float | None = Query(default=52.0),
    rsi_max: float | None = Query(default=78.0),
    change_min: float | None = Query(default=1.2),
    limit: int = Query(default=75, ge=1, le=300),
    db: Session = Depends(get_timescale_db),
) -> list[ScreenerOut]:
    rsi_min_val = float(rsi_min if rsi_min is not None else 52.0)
    rsi_max_val = float(rsi_max if rsi_max is not None else 78.0)
    change_min_val = float(change_min if change_min is not None else 1.2)
    idx_key = (index_key or "all").strip().lower()

    requested_symbols = [
        _safe_symbol(part)
        for part in (symbols or "").split(",")
        if _safe_symbol(part)
    ]
    requested_symbols = list(dict.fromkeys(requested_symbols))
    scoped_symbols = requested_symbols or _fetch_index_constituents(idx_key)
    if not scoped_symbols:
        return []

    local_universe = _load_local_nse_universe()
    symbol_name_map = {symbol: name for symbol, name in local_universe}
    metrics_map = _fetch_screener_metrics(
        db,
        scoped_symbols[:limit],
        rsi_min=rsi_min_val,
        rsi_max=rsi_max_val,
        change_min=change_min_val,
    )

    out: list[ScreenerOut] = []
    now = dt.datetime.now(dt.timezone.utc)
    for symbol in scoped_symbols[:limit]:
        metrics = metrics_map.get(symbol)
        out.append(
            ScreenerOut(
                symbol=symbol,
                name=symbol_name_map.get(symbol),
                rsi=metrics.rsi if metrics else None,
                macd=metrics.macd if metrics else None,
                change_1d=metrics.change_1d if metrics else None,
                change_5d=metrics.change_5d if metrics else None,
                change_1m=metrics.change_1m if metrics else None,
                ema_20=metrics.ema_20 if metrics else None,
                ema_50=metrics.ema_50 if metrics else None,
                ema_200=metrics.ema_200 if metrics else None,
                pe_ratio=metrics.pe_ratio if metrics else None,
                roe=metrics.roe if metrics else None,
                is_breakout=metrics.is_breakout if metrics else None,
                breakout_score=metrics.breakout_score if metrics else None,
                index_buckets=[idx_key] if idx_key != "all" else None,
                last_updated=metrics.last_updated if metrics and metrics.last_updated is not None else now,
            )
        )
    return out


@router.get("/screener", response_model=list[ScreenerOut])
def get_screened_stocks(
    rsi_min: float | None = Query(default=52.0),
    rsi_max: float | None = Query(default=78.0),
    change_min: float | None = Query(default=1.2),
    index_key: str = Query(default="all"),
    breakout_only: bool = Query(default=True),
    limit: int = Query(default=75, ge=10, le=300),
    db: Session = Depends(get_timescale_db),
) -> list[ScreenerOut]:
    rsi_min_val = float(rsi_min if rsi_min is not None else 52.0)
    rsi_max_val = float(rsi_max if rsi_max is not None else 78.0)
    change_min_val = float(change_min if change_min is not None else 1.2)
    idx_key = (index_key or "all").strip().lower()
    if idx_key not in _INDEX_DEFINITIONS:
        idx_key = "all"

    if settings.mock_data:
        return [
            ScreenerOut(symbol="RELIANCE", name="Reliance Industries Limited", rsi=55.2, macd=1.2, change_1d=1.5, change_5d=3.2, change_1m=5.1, ema_20=2450.0, ema_50=2400.0, ema_200=2300.0, is_breakout=True, breakout_score=8.4, index_buckets=[idx_key], last_updated=dt.datetime.now(dt.timezone.utc)),
            ScreenerOut(symbol="TCS", name="Tata Consultancy Services Limited", rsi=63.1, macd=0.5, change_1d=1.8, change_5d=2.1, change_1m=3.0, ema_20=3400.0, ema_50=3350.0, ema_200=3300.0, is_breakout=True, breakout_score=7.2, index_buckets=[idx_key], last_updated=dt.datetime.now(dt.timezone.utc)),
            ScreenerOut(symbol="HDFCBANK", name="HDFC Bank Limited", rsi=68.5, macd=2.1, change_1d=2.2, change_5d=4.5, change_1m=8.2, ema_20=1650.0, ema_50=1600.0, ema_200=1550.0, is_breakout=True, breakout_score=9.1, index_buckets=[idx_key], last_updated=dt.datetime.now(dt.timezone.utc)),
        ]

    local_universe = _load_local_nse_universe()
    symbol_name_map = {symbol: name for symbol, name in local_universe}
    selected_symbols = _fetch_index_constituents(idx_key)

    # Keep the index screener responsive even when the heavier Timescale scan path is slow.
    if idx_key != "all" and selected_symbols:
        quick_metrics = _fetch_screener_metrics(
            db,
            selected_symbols,
            rsi_min=rsi_min_val,
            rsi_max=rsi_max_val,
            change_min=change_min_val,
        )
        quick_prices = _fetch_latest_price_snapshots(db, selected_symbols)
        quick_rows: list[ScreenerOut] = []
        for symbol in selected_symbols:
            metrics = quick_metrics.get(symbol)
            current_price, last_price_time = quick_prices.get(symbol, (None, None))
            quick_rows.append(
                ScreenerOut(
                    symbol=symbol,
                    name=symbol_name_map.get(symbol),
                    current_price=current_price,
                    rsi=metrics.rsi if metrics else None,
                    macd=metrics.macd if metrics else None,
                    change_1d=metrics.change_1d if metrics else None,
                    change_5d=metrics.change_5d if metrics else None,
                    change_1m=metrics.change_1m if metrics else None,
                    pe_ratio=metrics.pe_ratio if metrics else None,
                    roe=metrics.roe if metrics else None,
                    ema_20=metrics.ema_20 if metrics else None,
                    ema_50=metrics.ema_50 if metrics else None,
                    ema_200=metrics.ema_200 if metrics else None,
                    is_breakout=metrics.is_breakout if metrics else None,
                    breakout_score=metrics.breakout_score if metrics else None,
                    index_buckets=[idx_key],
                    last_updated=last_price_time or (metrics.last_updated if metrics else dt.datetime.now(dt.timezone.utc)),
                )
            )
        if quick_rows and any(
            row.current_price is not None
            or row.rsi is not None
            or row.change_1d is not None
            for row in quick_rows
        ):
            filtered_rows = [
                row
                for row in quick_rows
                if _passes_screener_range_filters(
                    row.rsi,
                    row.change_1d,
                    rsi_min=rsi_min_val,
                    rsi_max=rsi_max_val,
                    change_min=change_min_val,
                )
            ]
            if breakout_only:
                filtered_rows = [row for row in filtered_rows if row.is_breakout]
            filtered_rows.sort(
                key=lambda row: (
                    1 if row.is_breakout else 0,
                    row.breakout_score if row.breakout_score is not None else float("-inf"),
                    row.change_1d if row.change_1d is not None else float("-inf"),
                ),
                reverse=True,
            )
            ordered_rows = filtered_rows
            return ordered_rows[:limit]

    try:
        _bootstrap_symbols_if_needed(db)
    except Exception:
        pass
    try:
        symbol_name_map.update(
            {
                str(r.symbol): r.name
                for r in db.execute(text("SELECT symbol, name FROM symbols")).all()
            }
        )
    except Exception:
        pass

    base_sql = """
        WITH latest_prices AS (
            SELECT DISTINCT ON (symbol) symbol, close
            FROM ohlcv
            ORDER BY symbol, time DESC
        )
        SELECT
            sc.symbol,
            s.name,
            lp.close AS current_price,
            sc.rsi,
            sc.macd,
            sc.change_1d,
            sc.change_5d,
            sc.change_1m,
            sc.ema_20,
            sc.ema_50,
            sc.ema_200,
            sc.pe_ratio,
            sc.roe,
            sc.last_updated,
            (
                COALESCE(sc.change_1d, 0) * 0.6 +
                COALESCE(sc.change_5d, 0) * 0.3 +
                (COALESCE(sc.rsi, 50) - 50) * 0.08 +
                CASE WHEN sc.ema_20 > sc.ema_50 THEN 1.2 ELSE 0 END +
                CASE WHEN sc.ema_50 >= sc.ema_200 THEN 1.2 ELSE 0 END +
                CASE WHEN sc.macd > 0 THEN 1.0 ELSE 0 END
            ) AS breakout_score,
            CASE WHEN
                sc.change_1d >= :change_min
                AND sc.rsi BETWEEN :rsi_min AND :rsi_max
                AND sc.ema_20 > sc.ema_50
                AND sc.ema_50 >= sc.ema_200
                AND COALESCE(sc.macd, 0) > 0
            THEN TRUE ELSE FALSE END AS is_breakout
        FROM screener sc
        LEFT JOIN symbols s ON s.symbol = sc.symbol
        LEFT JOIN latest_prices lp ON lp.symbol = sc.symbol
        WHERE sc.rsi IS NOT NULL
          AND sc.change_1d IS NOT NULL
          AND sc.ema_20 IS NOT NULL
          AND sc.ema_50 IS NOT NULL
          AND sc.ema_200 IS NOT NULL
    """

    def _query_db(apply_breakout_rules: bool, row_limit: int) -> list[ScreenerOut]:
        sql = base_sql
        params: dict[str, object] = {
            "rsi_min": rsi_min_val,
            "rsi_max": rsi_max_val,
            "change_min": change_min_val,
            "limit": row_limit,
        }

        if idx_key != "all" and selected_symbols:
            sql = _apply_symbol_scope(sql, params, selected_symbols)

        if apply_breakout_rules:
            sql += """
                AND sc.change_1d >= :change_min
                AND sc.rsi BETWEEN :rsi_min AND :rsi_max
                AND sc.ema_20 > sc.ema_50
                AND sc.ema_50 >= sc.ema_200
                AND COALESCE(sc.macd, 0) > 0
            """

        sql += " ORDER BY breakout_score DESC, sc.change_1d DESC NULLS LAST LIMIT :limit"
        rows = db.execute(text(sql), params).all()

        return [
            ScreenerOut(
                symbol=r.symbol,
                name=r.name,
                current_price=float(r.current_price) if r.current_price is not None else None,
                rsi=float(r.rsi) if r.rsi is not None else None,
                macd=float(r.macd) if r.macd is not None else None,
                change_1d=float(r.change_1d) if r.change_1d is not None else None,
                change_5d=float(r.change_5d) if r.change_5d is not None else None,
                change_1m=float(r.change_1m) if r.change_1m is not None else None,
                ema_20=float(r.ema_20) if r.ema_20 is not None else None,
                ema_50=float(r.ema_50) if r.ema_50 is not None else None,
                ema_200=float(r.ema_200) if r.ema_200 is not None else None,
                pe_ratio=float(r.pe_ratio) if r.pe_ratio is not None else None,
                roe=float(r.roe) if r.roe is not None else None,
                is_breakout=bool(r.is_breakout),
                breakout_score=float(r.breakout_score) if r.breakout_score is not None else None,
                index_buckets=[idx_key],
                last_updated=r.last_updated,
            )
            for r in rows
        ]

    results = _query_db(apply_breakout_rules=breakout_only, row_limit=limit)

    if results:
        live_price_map = _refresh_symbol_prices(db, [row.symbol for row in results])
        for row in results:
            live_row = live_price_map.get(row.symbol)
            if live_row and live_row.current_price is not None:
                row.current_price = float(live_row.current_price)
            if live_row and live_row.change_pct is not None and row.change_1d is None:
                row.change_1d = float(live_row.change_pct)

    if results:
        return results

    live_symbols = selected_symbols or list(symbol_name_map.keys())
    live_scan = _scan_breakouts_live(
        symbols=live_symbols,
        symbol_name_map=symbol_name_map,
        index_key=idx_key,
        rsi_min=rsi_min_val,
        rsi_max=rsi_max_val,
        change_min=change_min_val,
        breakout_only=breakout_only,
        limit=limit,
    )
    if live_scan:
        return live_scan
    return []


@router.get("/stocks", response_model=list[SymbolOut])
def list_stocks(
    limit: int = Query(default=50, ge=1, le=500),
    index_key: str | None = Query(default=None),
    symbols: str | None = Query(default=None),
    db: Session = Depends(get_timescale_db),
) -> list[SymbolOut]:
    requested_symbols = [
        _safe_symbol(part)
        for part in (symbols or "").split(",")
        if _safe_symbol(part)
    ]
    requested_symbols = list(dict.fromkeys(requested_symbols))
    selected_symbols = requested_symbols or _fetch_index_constituents(index_key or "all")
    local_universe = _load_local_nse_universe()
    local_name_map = {symbol: name for symbol, name in local_universe}

    if settings.mock_data:
        stocks_data = [
            SymbolOut(symbol="RELIANCE", name="Reliance Industries Ltd", current_price=2985.50, change_pct=1.25),
            SymbolOut(symbol="TCS", name="Tata Consultancy Services Ltd", current_price=4120.20, change_pct=0.76),
            SymbolOut(symbol="HDFCBANK", name="HDFC Bank Ltd", current_price=1725.00, change_pct=1.93),
            SymbolOut(symbol="INFY", name="Infosys Ltd", current_price=1910.70, change_pct=-0.52),
            SymbolOut(symbol="ICICIBANK", name="ICICI Bank Ltd", current_price=1240.30, change_pct=1.11),
            SymbolOut(symbol="SBIN", name="State Bank of India", current_price=840.50, change_pct=0.44),
            SymbolOut(symbol="ITC", name="ITC Ltd", current_price=450.20, change_pct=-0.31),
            SymbolOut(symbol="LT", name="Larsen & Toubro Ltd", current_price=3500.00, change_pct=0.68),
        ]
        if requested_symbols:
            by_symbol = {row.symbol: row for row in stocks_data}
            return [by_symbol[symbol] for symbol in requested_symbols if symbol in by_symbol][:limit]
        if selected_symbols:
            allowed = set(selected_symbols)
            return [row for row in stocks_data if row.symbol in allowed][:limit]
        return stocks_data[:limit]
    
    base_symbols: list[str] = []
    if selected_symbols:
        base_symbols = selected_symbols[:limit]
    elif local_universe:
        base_symbols = [symbol for symbol, _ in local_universe[:limit]]

    if base_symbols:
        snapshots = _fetch_yfinance_equity_snapshots(base_symbols)
        out = [
            SymbolOut(
                symbol=symbol,
                name=local_name_map.get(symbol),
                current_price=_to_float((snapshots.get(symbol) or {}).get("current_price")),
                change_pct=_to_float((snapshots.get(symbol) or {}).get("change_pct")),
            )
            for symbol in base_symbols
        ]
        # Backfill any symbol that missed live quote resolution so the ticker/cards do not show blanks.
        missing_live_symbols = [row.symbol for row in out if row.current_price is None]
        if missing_live_symbols:
            params_fill: dict[str, object] = {}
            fill_sql = """
                WITH latest_prices AS (
                    SELECT DISTINCT ON (symbol) symbol, close, open
                    FROM ohlcv
                    WHERE 1 = 1
            """
            fill_sql = _apply_symbol_scope(fill_sql, params_fill, missing_live_symbols, column_name="symbol")
            fill_sql += """
                    ORDER BY symbol, time DESC
                )
                SELECT symbol, close,
                       CASE WHEN open != 0 THEN (close - open) / open * 100 ELSE NULL END as change_pct
                FROM latest_prices
            """
            try:
                fallback_rows = db.execute(text(fill_sql), params_fill).all()
                fallback_map = {
                    _safe_symbol(str(r.symbol)): (
                        float(r.close) if r.close is not None else None,
                        float(r.change_pct) if r.change_pct is not None else None,
                    )
                    for r in fallback_rows
                }
                for row in out:
                    if row.current_price is not None:
                        continue
                    backfill = fallback_map.get(row.symbol)
                    if not backfill:
                        continue
                    backfill_price, backfill_change = backfill
                    if backfill_price is not None:
                        row.current_price = backfill_price
                    if row.change_pct is None and backfill_change is not None:
                        row.change_pct = backfill_change
            except Exception:
                pass
        if requested_symbols:
            # For explicit quote requests, do not fall back to potentially stale DB prices.
            return out[:limit]
        if any(row.current_price is not None for row in out):
            return out[:limit]

    # Ensure symbol universe exists even after DB resets/migrations.
    try:
        _bootstrap_symbols_if_needed(db)
    except Exception:
        pass

    # Fallback to latest stored DB prices.
    sql = """
        WITH latest_prices AS (
            SELECT DISTINCT ON (symbol) symbol, close, open
            FROM ohlcv
            ORDER BY symbol, time DESC
        )
        SELECT s.symbol, s.name, lp.close,
               CASE WHEN lp.open != 0 THEN (lp.close - lp.open) / lp.open * 100 ELSE NULL END as change_pct
        FROM symbols s
        LEFT JOIN latest_prices lp ON s.symbol = lp.symbol
    """
    params: dict[str, object] = {"limit": limit}
    if selected_symbols:
        sql = _apply_symbol_scope(sql, params, selected_symbols, column_name="s.symbol")
    sql += """
        ORDER BY s.symbol ASC
        LIMIT :limit
    """

    rows = []
    try:
        rows = db.execute(text(sql), params).all()
    except Exception:
        rows = []

    out: list[SymbolOut] = []
    for r in rows:
        try:
            out.append(
                SymbolOut(
                    symbol=r[0],
                    name=r[1],
                    current_price=float(r[2]) if r[2] is not None else None,
                    change_pct=float(r[3]) if r[3] is not None else None,
                )
            )
        except Exception:
            continue
    if requested_symbols and out:
        by_symbol = {row.symbol: row for row in out}
        ordered = [by_symbol[symbol] for symbol in requested_symbols if symbol in by_symbol]
        if ordered:
            return ordered[:limit]
    if out:
        return out

    # Fallback path: return at least symbol/name when prices are unavailable.
    try:
        fallback_sql = "SELECT symbol, name FROM symbols"
        fallback_params: dict[str, object] = {"limit": limit}
        if selected_symbols:
            fallback_sql = _apply_symbol_scope(
                fallback_sql,
                fallback_params,
                selected_symbols,
                column_name="symbol",
            )
        fallback_sql += " ORDER BY symbol ASC LIMIT :limit"
        fallback_rows = db.execute(text(fallback_sql), fallback_params).all()
        for r in fallback_rows:
            symbol = str(r[0]).strip() if r[0] is not None else ""
            if not symbol:
                continue
            name = str(r[1]).strip() if r[1] is not None else None
            out.append(SymbolOut(symbol=symbol, name=name, current_price=None, change_pct=None))
    except Exception:
        out = []

    if out:
        if requested_symbols:
            by_symbol = {row.symbol: row for row in out}
            ordered = [by_symbol[symbol] for symbol in requested_symbols if symbol in by_symbol]
            if ordered:
                return ordered[:limit]
        return out

    # Last-resort fallback from bundled symbol universe.
    if selected_symbols:
        allowed = set(selected_symbols)
        local_universe = [(symbol, name) for symbol, name in local_universe if symbol in allowed]
    if requested_symbols:
        local_map = {symbol: name for symbol, name in local_universe}
        ordered_universe = [(symbol, local_map.get(symbol)) for symbol in requested_symbols if symbol in local_map]
        local_universe = ordered_universe
    for symbol, name in local_universe[:limit]:
        out.append(SymbolOut(symbol=symbol, name=name, current_price=None, change_pct=None))
    return out


@router.get("/ohlcv/{symbol}", response_model=list[OhlcvOut])
def get_ohlcv(
    symbol: str,
    start: dt.datetime | None = Query(default=None),
    end: dt.datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
    db: Session = Depends(get_timescale_db),
) -> list[OhlcvOut]:
    symbol = _safe_symbol(symbol)
    if settings.mock_data:
        base_prices = {
            "RELIANCE": 2985.5,
            "TCS": 4120.2,
            "HDFCBANK": 1725.0,
            "INFY": 1910.7,
            "ICICIBANK": 1240.3,
            "SBIN": 840.5,
            "ITC": 450.2,
            "LT": 3500.0,
        }
        base = base_prices.get(symbol, 1000.0)

        now = dt.datetime.now()
        data = []
        current_close = base
        import random
        random.seed(symbol)  # Deterministic for layout stability

        for i in range(limit):
            t = now - dt.timedelta(days=i)
            open_price = current_close * (1 + random.uniform(-0.01, 0.01))
            high_price = max(open_price, current_close) * (1 + random.uniform(0, 0.01))
            low_price = min(open_price, current_close) * (1 - random.uniform(0, 0.01))

            data.append(OhlcvOut(
                time=t.isoformat(),
                open=open_price,
                high=high_price,
                low=low_price,
                close=current_close,
                volume=random.randint(500000, 2000000)
            ))
            current_close = open_price

        data.reverse()  # chronological order
        return data

    where = ["symbol = :symbol"]
    params: dict = {"symbol": symbol, "limit": limit}
    if start is not None:
        where.append("time >= :start")
        params["start"] = start
    if end is not None:
        where.append("time <= :end")
        params["end"] = end

    sql = f"""
        select time, open, high, low, close, volume
        from ohlcv
        where {' and '.join(where)}
        order by time desc
        limit :limit
    """
    try:
        rows = db.execute(text(sql), params).all()
    except Exception:
        return []

    out: list[OhlcvOut] = []
    for r in rows:
        if r[0] is None or r[1] is None or r[2] is None or r[3] is None or r[4] is None:
            continue
        try:
            out.append(
                OhlcvOut(
                    time=r[0],
                    open=float(r[1]),
                    high=float(r[2]),
                    low=float(r[3]),
                    close=float(r[4]),
                    volume=float(r[5]) if r[5] is not None else 0.0,
                )
            )
        except Exception:
            continue
    out.reverse()
    if out:
        return out

    # Only try live providers when stored candles are unavailable.
    for loader in (_fetch_yahoo_chart_history, _fetch_yfinance_chart_history):
        try:
            fresh_rows = loader(symbol, start=start, end=end, limit=limit)
            if fresh_rows:
                return fresh_rows
        except Exception:
            continue

    return out


@router.get("/ohlcv-lite/{symbol}", response_model=list[OhlcvOut])
def get_ohlcv_lite(
    symbol: str,
    start: dt.datetime | None = Query(default=None),
    end: dt.datetime | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[OhlcvOut]:
    symbol = _safe_symbol(symbol)
    for loader in (_fetch_yfinance_chart_history, _fetch_yahoo_chart_history):
        try:
            fresh_rows = loader(symbol, start=start, end=end, limit=limit)
            if fresh_rows:
                return fresh_rows
        except Exception:
            continue
    return []


@router.get("/ohlcv-intraday/{symbol}", response_model=list[OhlcvOut])
def get_ohlcv_intraday(
    symbol: str,
    limit: int = Query(default=120, ge=1, le=500),
) -> list[OhlcvOut]:
    symbol = _safe_symbol(symbol)
    for loader in (_fetch_yfinance_intraday_history, _fetch_yahoo_intraday_history):
        try:
            fresh_rows = loader(symbol, limit=limit)
            if fresh_rows:
                return fresh_rows
        except Exception:
            continue
    return []


@router.get("/analytics/{symbol}", response_model=AnalyticsOut)
def get_analytics(
    symbol: str,
    db: Session = Depends(get_timescale_db),
) -> AnalyticsOut:
    index_alias = _resolve_index_alias(symbol)
    canonical_symbol = index_alias[0] if index_alias else _safe_symbol(symbol)
    yf_sym = index_alias[1] if index_alias else f"{canonical_symbol}.NS"

    try:
        import yfinance as yf
        import pandas as pd
        import numpy as np
        _configure_yfinance_cache(yf)

        ticker = yf.Ticker(yf_sym)
        
        # Fundamentals
        info = ticker.info
        
        # Technicals - fetch 1 year of daily data to ensure we have enough for 200 EMA/RSI
        hist = ticker.history(period="1y")
        
        out = AnalyticsOut(symbol=canonical_symbol)
        
        if len(hist) > 0:
            close = hist['Close']
            
            # Helper for RSI
            def calc_rsi(series, period):
                if len(series) < period + 1: return None
                delta = series.diff()
                up = delta.clip(lower=0)
                down = -1 * delta.clip(upper=0)
                ema_up = up.ewm(com=period-1, adjust=False).mean()
                ema_down = down.ewm(com=period-1, adjust=False).mean()
                rs = ema_up / ema_down
                res = 100 - (100 / (1 + rs)).iloc[-1]
                return float(res) if not pd.isna(res) else None
                
            out.rsi_14 = calc_rsi(close, 14)
            out.rsi_30 = calc_rsi(close, 30)
            out.rsi_50 = calc_rsi(close, 50)
            out.rsi_100 = calc_rsi(close, 100)
            out.rsi_200 = calc_rsi(close, 200)
            
            # MACD
            if len(close) >= 26:
                exp1 = close.ewm(span=12, adjust=False).mean()
                exp2 = close.ewm(span=26, adjust=False).mean()
                macd = exp1 - exp2
                signal = macd.ewm(span=9, adjust=False).mean()
                hist_val = macd - signal
                out.macd_value = float(macd.iloc[-1]) if not pd.isna(macd.iloc[-1]) else None
                out.macd_signal = float(signal.iloc[-1]) if not pd.isna(signal.iloc[-1]) else None
                out.macd_hist = float(hist_val.iloc[-1]) if not pd.isna(hist_val.iloc[-1]) else None
                
            # EMA
            if len(close) >= 20: 
                v = close.ewm(span=20, adjust=False).mean().iloc[-1]
                out.ema_20 = float(v) if not pd.isna(v) else None
            if len(close) >= 50: 
                v = close.ewm(span=50, adjust=False).mean().iloc[-1]
                out.ema_50 = float(v) if not pd.isna(v) else None
            if len(close) >= 200: 
                v = close.ewm(span=200, adjust=False).mean().iloc[-1]
                out.ema_200 = float(v) if not pd.isna(v) else None
            
            # Bollinger Bands (20, 2)
            if len(close) >= 20:
                sma_20 = close.rolling(window=20).mean()
                std_20 = close.rolling(window=20).std()
                mid = sma_20.iloc[-1]
                up = (sma_20 + 2 * std_20).iloc[-1]
                low = (sma_20 - 2 * std_20).iloc[-1]
                out.bb_middle = float(mid) if not pd.isna(mid) else None
                out.bb_upper = float(up) if not pd.isna(up) else None
                out.bb_lower = float(low) if not pd.isna(low) else None
                
        # Fill fundamentals
        out.pe_ratio = info.get('trailingPE')
        out.pb_ratio = info.get('priceToBook')
        out.roe = info.get('returnOnEquity')
        if out.roe is not None: out.roe *= 100.0 # Convert to percentage
        
        out.debt_to_equity = info.get('debtToEquity')
        out.revenue_growth_yoy = info.get('revenueGrowth')
        if out.revenue_growth_yoy is not None: out.revenue_growth_yoy *= 100.0
        
        out.eps_growth = info.get('earningsGrowth')
        if out.eps_growth is not None: out.eps_growth *= 100.0
        
        ph = info.get('heldPercentInsiders')
        if ph is not None: out.promoter_holding = ph * 100.0
        fh = info.get('heldPercentInstitutions')
        if fh is not None: out.fii_dii_holding = fh * 100.0
        
        # New Google Parity Stats
        c_price = info.get('currentPrice')
        prev_close = info.get('previousClose')
        
        if c_price is None and len(hist) > 0:
            c_price = float(hist['Close'].iloc[-1])
        if prev_close is None and len(hist) > 1:
            prev_close = float(hist['Close'].iloc[-2])
            
        out.current_price = c_price
        out.previous_close = prev_close
        
        if c_price is not None and prev_close is not None and prev_close > 0:
            out.day_change = c_price - prev_close
            out.day_change_pct = (out.day_change / prev_close) * 100.0

        out.regular_market_open = info.get('regularMarketOpen')
        if out.regular_market_open is None and len(hist) > 0: out.regular_market_open = float(hist['Open'].iloc[-1])
        
        out.day_high = info.get('dayHigh')
        if out.day_high is None and len(hist) > 0: out.day_high = float(hist['High'].iloc[-1])
        
        out.day_low = info.get('dayLow')
        if out.day_low is None and len(hist) > 0: out.day_low = float(hist['Low'].iloc[-1])
            
        out.fifty_two_week_high = info.get('fiftyTwoWeekHigh')
        out.fifty_two_week_low = info.get('fiftyTwoWeekLow')
        out.market_cap = info.get('marketCap')
        
        dy = info.get('dividendYield')
        if dy is not None:
            out.dividend_yield = dy * 100.0
        
        # Clean up any NaNs to None for JSON serialization
        import math
        for k, v in out.model_dump().items():
            if isinstance(v, float) and math.isnan(v):
                setattr(out, k, None)
                
        return out
        
    except Exception as e:
        import traceback
        import logging
        logging.error(f"Error fetching analytics for {canonical_symbol}: {e}\n{traceback.format_exc()}")

        out = AnalyticsOut(symbol=canonical_symbol)
        current_price = None
        day_change_pct = None

        if index_alias:
            current_price, day_change, day_change_pct, _ = _fetch_yfinance_index_quote(yf_sym)
            if current_price is None and canonical_symbol == "NIFTY 50":
                try:
                    nse_curr, nse_change, nse_pct = _fetch_nse_index_quote("NIFTY 50")
                    current_price = nse_curr if current_price is None else current_price
                    day_change = nse_change if day_change is None else day_change
                    day_change_pct = nse_pct if day_change_pct is None else day_change_pct
                except Exception:
                    pass
            out.current_price = current_price
            out.day_change = day_change
            out.day_change_pct = day_change_pct
            if current_price is not None and day_change_pct not in (None,):
                out.previous_close = (
                    current_price / (1.0 + (day_change_pct / 100.0))
                    if day_change_pct != -100
                    else None
                )
            return out

        snapshot = _fetch_yfinance_equity_snapshots([canonical_symbol]).get(canonical_symbol)
        current_price = _to_float(snapshot.get("current_price")) if snapshot else None
        day_change_pct = _to_float(snapshot.get("change_pct")) if snapshot else None

        if current_price is None:
            latest_map = _fetch_latest_price_snapshots(db, [canonical_symbol])
            current_price = latest_map.get(canonical_symbol, (None, None))[0]

        previous_close = None
        day_change = None
        if current_price is not None and day_change_pct not in (None,):
            previous_close = current_price / (1.0 + (day_change_pct / 100.0)) if day_change_pct != -100 else None
            if previous_close is not None:
                day_change = current_price - previous_close

        out.current_price = current_price
        out.previous_close = previous_close
        out.day_change = day_change
        out.day_change_pct = day_change_pct
        return out
