import pandas as pd
import pandas_ta_classic as ta
from sqlalchemy.orm import Session
from app.models.ohlcv import Ohlcv
from app.models.screener import Screener
from app.models.symbol import Symbol
import datetime as dt

def refresh_screener_data(db: Session):
    # Fetch all symbols
    symbols = db.query(Symbol).all()
    
    for s in symbols:
        # Get last 200 OHLCV records for indicators
        ohlcv_data = db.query(Ohlcv).filter(Ohlcv.symbol == s.symbol).order_by(Ohlcv.time.desc()).limit(200).all()
        if not ohlcv_data:
            continue
            
        # Convert to DataFrame
        df = pd.DataFrame([{
            'time': x.time,
            'open': float(x.open),
            'high': float(x.high),
            'low': float(x.low),
            'close': float(x.close),
            'volume': float(x.volume)
        } for x in reversed(ohlcv_data)])
        
        if len(df) < 20: # Minimum needed for some indicators
            continue
            
        # Calculate indicators
        df['rsi'] = ta.rsi(df['close'], length=14)
        macd = ta.macd(df['close'])
        if macd is not None:
             df['macd'] = macd['MACD_12_26_9']
        
        df['ema_20'] = ta.ema(df['close'], length=20)
        df['ema_50'] = ta.ema(df['close'], length=50)
        df['ema_200'] = ta.ema(df['close'], length=200)
        
        bbands = ta.bbands(df['close'], length=20, std=2)
        if bbands is not None:
            df['bb_upper'] = bbands['BBU_20_2.0']
            df['bb_lower'] = bbands['BBL_20_2.0']
        
        # Calculate changes (1d, 5d, 1m)
        df['change_1d'] = df['close'].pct_change(1) * 100
        df['change_5d'] = df['close'].pct_change(5) * 100
        df['change_1m'] = df['close'].pct_change(20) * 100
        
        last_row = df.iloc[-1]
        
        # Upsert into screener table
        screener_entry = db.query(Screener).filter(Screener.symbol == s.symbol).first()
        if not screener_entry:
            screener_entry = Screener(symbol=s.symbol)
            db.add(screener_entry)
            
        screener_entry.rsi = float(last_row['rsi']) if not pd.isna(last_row['rsi']) else None
        screener_entry.macd = float(last_row['macd']) if 'macd' in last_row and not pd.isna(last_row['macd']) else None
        screener_entry.ema_20 = float(last_row['ema_20']) if not pd.isna(last_row['ema_20']) else None
        screener_entry.ema_50 = float(last_row['ema_50']) if not pd.isna(last_row['ema_50']) else None
        screener_entry.ema_200 = float(last_row['ema_200']) if not pd.isna(last_row['ema_200']) else None
        screener_entry.bb_upper = float(last_row['bb_upper']) if 'bb_upper' in last_row and not pd.isna(last_row['bb_upper']) else None
        screener_entry.bb_lower = float(last_row['bb_lower']) if 'bb_lower' in last_row and not pd.isna(last_row['bb_lower']) else None
        
        screener_entry.change_1d = float(last_row['change_1d']) if not pd.isna(last_row['change_1d']) else None
        screener_entry.change_5d = float(last_row['change_5d']) if not pd.isna(last_row['change_5d']) else None
        screener_entry.change_1m = float(last_row['change_1m']) if not pd.isna(last_row['change_1m']) else None
        
        # Fundamentals (These will be updated by the ingestion service)
        # But we can provide a method to update them here if passed
        
        screener_entry.last_updated = dt.datetime.now(dt.timezone.utc)
        
    db.commit()
