from sqlalchemy import Column, String, DateTime, Numeric
from app.db.timescale_db import Base

class Ohlcv(Base):
    __tablename__ = "ohlcv"

    time = Column(DateTime(timezone=True), primary_key=True, index=True)
    symbol = Column(String, primary_key=True, index=True)
    open = Column(Numeric)
    high = Column(Numeric)
    low = Column(Numeric)
    close = Column(Numeric)
    volume = Column(Numeric)
