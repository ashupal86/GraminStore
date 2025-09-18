from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    sku = Column(String(100), nullable=True, unique=True)
    current_quantity = Column(Integer, default=0, nullable=False)
    min_quantity = Column(Integer, default=5, nullable=False)
    unit_price = Column(Float, nullable=True)
    unit = Column(String(50), default="pieces", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    merchant = relationship("Merchant", back_populates="inventory_items")
    
    @property
    def is_low_stock(self):
        return self.current_quantity <= self.min_quantity


class PurchaseListItem(Base):
    __tablename__ = "purchase_list_items"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity_needed = Column(Integer, nullable=False)
    is_purchased = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    merchant = relationship("Merchant", back_populates="purchase_list_items")
    inventory_item = relationship("InventoryItem")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # 'in', 'out', 'adjustment'
    quantity_change = Column(Integer, nullable=False)
    previous_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    merchant = relationship("Merchant", back_populates="inventory_transactions")
    inventory_item = relationship("InventoryItem")
