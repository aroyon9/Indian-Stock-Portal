from sqlalchemy import Column, String
from app.db.timescale_db import Base

class Symbol(Base):
    __tablename__ = "symbols"

    symbol = Column(String, primary_key=True, index=True)
    name = Column(String)
