from __future__ import annotations
import datetime as dt
from pydantic import BaseModel
from decimal import Decimal

class PortfolioBase(BaseModel):
    symbol: str
    quantity: Decimal
    average_price: Decimal

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioOut(PortfolioBase):
    id: int
    user_id: int
    created_at: dt.datetime

    class Config:
        from_attributes = True

class WatchlistBase(BaseModel):
    symbol: str

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistOut(WatchlistBase):
    id: int
    user_id: int
    created_at: dt.datetime

    class Config:
        from_attributes = True
