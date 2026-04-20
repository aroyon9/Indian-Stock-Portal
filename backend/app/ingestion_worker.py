import time
import logging
from apscheduler.schedulers.blocking import BlockingScheduler
from app.db.timescale_db import SessionLocal
from app.services import ingestion_service, screener_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def job_5_min():
    logger.info("Starting 5-minute live price update...")
    db = SessionLocal()
    try:
        ingestion_service.fetch_live_prices(db)
    finally:
        db.close()
    logger.info("Finished 5-minute update.")

def job_daily():
    logger.info("Starting daily historical and fundamental update...")
    db = SessionLocal()
    try:
        # 1. Fetch historical and fundamentals
        ingestion_service.fetch_historical_and_fundamentals(db)
        # 2. Refresh technical indicators in screener
        screener_service.refresh_screener_data(db)
    finally:
        db.close()
    logger.info("Finished daily update.")

if __name__ == "__main__":
    scheduler = BlockingScheduler()
    
    # Schedule live updates every 5 minutes during market hours (roughly)
    scheduler.add_job(job_5_min, 'interval', minutes=5)
    
    # Schedule full refresh daily at midnight
    scheduler.add_job(job_daily, 'cron', hour=0, minute=0)
    
    logger.info("Scheduler started. Press Ctrl+C to exit.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass
