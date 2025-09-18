"""
Merchant model for store owners
"""
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Merchant(BaseModel):
    """Merchant model for store owners"""
    __tablename__ = "merchants"
    
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    aadhar_number = Column(String(12), unique=True, index=True, nullable=False)
    # Optional fields for enhanced merchant profile
    business_name = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    zip_code = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    business_type = Column(String(100), nullable=True)
    
    # Relationships
    guest_users = relationship("GuestUser", back_populates="merchant", cascade="all, delete-orphan", lazy="select")
    inventory_items = relationship("InventoryItem", back_populates="merchant", cascade="all, delete-orphan", lazy="select")
    purchase_list_items = relationship("PurchaseListItem", back_populates="merchant", cascade="all, delete-orphan", lazy="select")
    inventory_transactions = relationship("InventoryTransaction", back_populates="merchant", cascade="all, delete-orphan", lazy="select")
    orders = relationship("Order", back_populates="merchant", cascade="all, delete-orphan", lazy="select")
    
    def __repr__(self):
        return f"<Merchant(id={self.id}, name='{self.name}', email='{self.email}')>"
