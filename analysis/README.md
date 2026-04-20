# Analysis

Small utilities for loading/analyzing OHLCV data stored in TimescaleDB.

## Load sample OHLCV into TimescaleDB

With Docker stack running:

```bash
pip install -r requirements.txt
python load_sample_ohlcv.py
```

This inserts synthetic OHLCV rows for the default symbols (`RELIANCE`, `TCS`, `INFY`).

