from sqlalchemy import Column, String, DateTime, Numeric, JSON
from app.db.timescale_db import Base

class Screener(Base):
    __tablename__ = "screener"

    symbol = Column(String, primary_key=True, index=True)
    last_updated = Column(DateTime(timezone=True))
    
    # Technical Indicators
    rsi = Column(Numeric)
    macd = Column(Numeric)
    macd_signal = Column(Numeric)
    macd_hist = Column(Numeric)
    ema_20 = Column(Numeric)
    ema_50 = Column(Numeric)
    ema_200 = Column(Numeric)
    bb_upper = Column(Numeric)
    bb_lower = Column(Numeric)
    
    # Performance
    change_1d = Column(Numeric)
    change_5d = Column(Numeric)
    change_1m = Column(Numeric)
    
    # Fundamental / Extra data
    pe_ratio = Column(Numeric)
    pb_ratio = Column(Numeric)
    roe = Column(Numeric)
    debt_to_equity = Column(Numeric)
    revenue_growth_yoy = Column(Numeric)
    eps_growth = Column(Numeric)
    promoter_holding = Column(Numeric)
    fii_holding = Column(Numeric)
    dii_holding = Column(Numeric)
    
    extra_data = Column(JSON, nullable=True)
