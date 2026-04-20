from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.db.user_db import get_user_db
from app.models.user import User
from app.schemas.portfolio import PortfolioCreate, PortfolioOut, WatchlistCreate, WatchlistOut
from app.services import portfolio_service

router = APIRouter()

@router.get("/portfolio", response_model=list[PortfolioOut])
def get_portfolio(
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
) -> list[PortfolioOut]:
    return portfolio_service.get_user_portfolio(db, user_id=current_user.id)

@router.post("/portfolio", response_model=PortfolioOut)
def add_portfolio_item(
    item: PortfolioCreate,
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
) -> PortfolioOut:
    return portfolio_service.add_to_portfolio(db, user_id=current_user.id, item=item)

@router.delete("/portfolio/{symbol}")
def remove_portfolio_item(
    symbol: str,
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
):
    deleted = portfolio_service.remove_from_portfolio(db, user_id=current_user.id, symbol=symbol)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Holding not found")
    return {"status": "ok"}

@router.get("/watchlist", response_model=list[WatchlistOut])
def get_watchlist(
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
) -> list[WatchlistOut]:
    return portfolio_service.get_user_watchlist(db, user_id=current_user.id)

@router.post("/watchlist", response_model=WatchlistOut)
def add_watchlist_item(
    item: WatchlistCreate,
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
) -> WatchlistOut:
    return portfolio_service.add_to_watchlist(db, user_id=current_user.id, item=item)

@router.delete("/watchlist/{symbol}")
def remove_watchlist_item(
    symbol: str,
    db: Session = Depends(get_user_db),
    current_user: User = Depends(deps.get_current_user),
):
    portfolio_service.remove_from_watchlist(db, user_id=current_user.id, symbol=symbol)
    return {"status": "ok"}
