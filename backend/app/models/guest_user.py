"""
Guest user model for transaction tracking - one per merchant only
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.database import Base
from datetime import datetime


class GuestUser(Base):
    """Guest user model - one per merchant only"""
    __tablename__ = "guest_users"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Essential fields only - one guest per merchant
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False, index=True, unique=True)
    transaction_id = Column(Integer, nullable=False)  # Required by database schema
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)  # Creation timestamp
    
    # Relationships
    merchant = relationship("Merchant", back_populates="guest_users")
    orders = relationship("Order", back_populates="guest_user", cascade="all, delete-orphan", lazy="select")
    
    def __repr__(self):
        return f"<GuestUser(id={self.id}, merchant_id={self.merchant_id})>"
