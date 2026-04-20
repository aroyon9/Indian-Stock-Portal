from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import auth, market, users, portfolio

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(market.router, tags=["market"])
api_router.include_router(portfolio.router, tags=["portfolio"])

