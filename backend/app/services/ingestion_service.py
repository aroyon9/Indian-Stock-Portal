import yfinance as yf
import nsepython as nse
from sqlalchemy.orm import Session
from app.models.symbol import Symbol
from app.models.ohlcv import Ohlcv
from app.models.screener import Screener
import datetime as dt
import logging

logger = logging.getLogger(__name__)

def fetch_live_prices(db: Session):
    """Fetch live prices for all symbols and update OHLCV."""
    symbols = db.query(Symbol).all()
    for s in symbols:
        try:
            # For NSE stocks, yfinance usually uses .NS suffix
            yf_symbol = f"{s.symbol}.NS"
            ticker = yf.Ticker(yf_symbol)
            data = ticker.fast_info
            
            # Simple live update (1m candle or current price as 1m candle)
            now = dt.datetime.now(dt.timezone.utc)
            new_ohlcv = Ohlcv(
                time=now,
                symbol=s.symbol,
                open=data.last_price,
                high=data.last_price,
                low=data.last_price,
                close=data.last_price,
                volume=0 # Or data.last_volume if available
            )
            db.add(new_ohlcv)
            logger.info(f"Updated live price for {s.symbol}: {data.last_price}")
        except Exception as e:
            logger.error(f"Error fetching live price for {s.symbol}: {e}")
    db.commit()

def fetch_historical_and_fundamentals(db: Session):
    """Fetch 1y historical data and fundamentals for all symbols."""
    symbols = db.query(Symbol).all()
    for s in symbols:
        try:
            yf_symbol = f"{s.symbol}.NS"
            ticker = yf.Ticker(yf_symbol)
            info = ticker.info
            
            # Update Screener table with fundamentals
            screener_entry = db.query(Screener).filter(Screener.symbol == s.symbol).first()
            if not screener_entry:
                screener_entry = Screener(symbol=s.symbol)
                db.add(screener_entry)
            
            screener_entry.pe_ratio = info.get('trailingPE')
            screener_entry.pb_ratio = info.get('priceToBook')
            screener_entry.roe = info.get('returnOnEquity')
            screener_entry.debt_to_equity = info.get('debtToEquity')
            
            # Growth metrics (placeholders/simple extraction)
            screener_entry.revenue_growth_yoy = info.get('revenueGrowth')
            screener_entry.eps_growth = info.get('earningsGrowth')
            
            # Shareholding
            screener_entry.promoter_holding = info.get('heldPercentInsiders')
            # FII/DII usually needs different extraction or info.get('heldPercentInstitutions')
            screener_entry.fii_holding = info.get('heldPercentInstitutions')
            
            screener_entry.last_updated = dt.datetime.now(dt.timezone.utc)
            
            # Fetch historical OHLCV (last 60 days)
            hist = ticker.history(period="60d")
            for index, row in hist.iterrows():
                time_val = index.to_pydatetime()
                # Check if exists
                exists = db.query(Ohlcv).filter(Ohlcv.symbol == s.symbol, Ohlcv.time == time_val).first()
                if not exists:
                    db.add(Ohlcv(
                        time=time_val,
                        symbol=s.symbol,
                        open=row['Open'],
                        high=row['High'],
                        low=row['Low'],
                        close=row['Close'],
                        volume=row['Volume']
                    ))
            
            logger.info(f"Updated fundamentals and history for {s.symbol}")
        except Exception as e:
            logger.error(f"Error fetching historical data for {s.symbol}: {e}")
    db.commit()
