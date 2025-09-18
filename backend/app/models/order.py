"""
Order model for storing marketplace orders
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base
from datetime import datetime

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String(50), unique=True, index=True, nullable=False)
    transaction_id = Column(Integer, nullable=False)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    guest_user_id = Column(Integer, ForeignKey("guest_users.id"), nullable=True)
    
    # Customer information
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=True)
    
    # Order details
    total_amount = Column(Float, nullable=False)
    payment_method = Column(String(20), nullable=False)
    status = Column(String(20), default="pending")  # pending, processing, completed, cancelled
    is_guest_order = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    merchant = relationship("Merchant", back_populates="orders")
    user = relationship("User", back_populates="orders")
    guest_user = relationship("GuestUser", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    
    # Item details
    item_id = Column(Integer, nullable=False)  # Reference to inventory item
    item_name = Column(String(200), nullable=False)
    item_category = Column(String(50), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="items")
