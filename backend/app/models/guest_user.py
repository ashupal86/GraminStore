"""
Guest user model for transaction tracking
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.models.database import Base
from datetime import datetime


class GuestUser(Base):
    """Simplified guest user model - one per transaction with minimal fields"""
    __tablename__ = "guest_users"
    
    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Essential fields only
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False, index=True)
    transaction_id = Column(Integer, nullable=False, index=True)  # Associated transaction ID
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)  # Creation timestamp
    
    # Relationships
    merchant = relationship("Merchant", back_populates="guest_users")
    
    def __repr__(self):
        return f"<GuestUser(id={self.id}, transaction_id={self.transaction_id}, merchant_id={self.merchant_id})>"
