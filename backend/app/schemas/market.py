from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class SymbolOut(BaseModel):
    symbol: str
    name: str | None = None
    current_price: float | None = None
    change_pct: float | None = None


class IndexOut(BaseModel):
    symbol: str
    name: str | None = None
    current_price: float | None = None
    day_change: float | None = None
    day_change_pct: float | None = None
    last_updated: dt.datetime | None = None


class OhlcvOut(BaseModel):
    time: dt.datetime
    open: float
    high: float
    low: float
    close: float
    volume: float

class ScreenerOut(BaseModel):
    symbol: str
    name: str | None = None
    current_price: float | None = None
    rsi: float | None = None
    macd: float | None = None
    change_1d: float | None = None
    change_5d: float | None = None
    change_1m: float | None = None
    ema_20: float | None = None
    ema_50: float | None = None
    ema_200: float | None = None
    bb_upper: float | None = None
    bb_lower: float | None = None
    
    # Fundamentals
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    revenue_growth_yoy: float | None = None
    eps_growth: float | None = None
    promoter_holding: float | None = None
    fii_holding: float | None = None
    dii_holding: float | None = None
    is_breakout: bool | None = None
    breakout_score: float | None = None
    volume_ratio: float | None = None
    index_buckets: list[str] | None = None
    
    last_updated: dt.datetime | None = None


class AnalyticsOut(BaseModel):
    symbol: str
    
    # Live Header Metrics
    current_price: float | None = None
    day_change: float | None = None
    day_change_pct: float | None = None
    
    # Session Metrics
    regular_market_open: float | None = None
    day_high: float | None = None
    day_low: float | None = None
    previous_close: float | None = None
    fifty_two_week_high: float | None = None
    fifty_two_week_low: float | None = None
    market_cap: float | None = None
    dividend_yield: float | None = None
    
    # Technicals
    rsi_14: float | None = None
    rsi_30: float | None = None
    rsi_50: float | None = None
    rsi_100: float | None = None
    rsi_200: float | None = None
    
    macd_value: float | None = None
    macd_signal: float | None = None
    macd_hist: float | None = None
    
    ema_20: float | None = None
    ema_50: float | None = None
    ema_200: float | None = None
    
    bb_upper: float | None = None
    bb_middle: float | None = None
    bb_lower: float | None = None
    
    # Fundamentals
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    revenue_growth_yoy: float | None = None
    eps_growth: float | None = None
    promoter_holding: float | None = None
    fii_dii_holding: float | None = None
