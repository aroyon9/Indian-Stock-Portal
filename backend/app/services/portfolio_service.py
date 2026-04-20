from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio, Watchlist
from app.schemas.portfolio import PortfolioCreate, WatchlistCreate

def get_user_portfolio(db: Session, user_id: int):
    return db.query(Portfolio).filter(Portfolio.user_id == user_id).all()

def add_to_portfolio(db: Session, user_id: int, item: PortfolioCreate):
    normalized_symbol = item.symbol.strip().upper()
    existing = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == user_id, Portfolio.symbol == normalized_symbol)
        .first()
    )
    if existing is not None:
        existing_qty = existing.quantity
        incoming_qty = item.quantity
        total_qty = existing_qty + incoming_qty
        if total_qty <= 0:
            existing.quantity = incoming_qty
            existing.average_price = item.average_price
        else:
            existing.average_price = (
                (existing_qty * existing.average_price) + (incoming_qty * item.average_price)
            ) / total_qty
            existing.quantity = total_qty
        db.commit()
        db.refresh(existing)
        return existing

    db_item = Portfolio(
        **item.model_dump(exclude={"symbol"}),
        symbol=normalized_symbol,
        user_id=user_id,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def remove_from_portfolio(db: Session, user_id: int, symbol: str) -> int:
    deleted = (
        db.query(Portfolio)
        .filter(Portfolio.user_id == user_id, Portfolio.symbol == symbol.strip().upper())
        .delete()
    )
    db.commit()
    return deleted

def get_user_watchlist(db: Session, user_id: int):
    return db.query(Watchlist).filter(Watchlist.user_id == user_id).all()

def add_to_watchlist(db: Session, user_id: int, item: WatchlistCreate):
    normalized_symbol = item.symbol.strip().upper()
    existing = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == user_id, Watchlist.symbol == normalized_symbol)
        .first()
    )
    if existing is not None:
        return existing

    db_item = Watchlist(**item.model_dump(exclude={"symbol"}), symbol=normalized_symbol, user_id=user_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def remove_from_watchlist(db: Session, user_id: int, symbol: str):
    db.query(Watchlist).filter(Watchlist.user_id == user_id, Watchlist.symbol == symbol.strip().upper()).delete()
    db.commit()
