from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class InventoryItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    current_quantity: int = Field(default=0, ge=0)
    min_quantity: int = Field(default=5, ge=0)
    unit_price: Optional[float] = Field(None, ge=0)
    unit: str = Field(default="pieces", max_length=50)
    is_active: bool = Field(default=True)


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    current_quantity: Optional[int] = Field(None, ge=0)
    min_quantity: Optional[int] = Field(None, ge=0)
    unit_price: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class InventoryItemResponse(InventoryItemBase):
    id: int
    merchant_id: int
    is_low_stock: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuantityUpdateRequest(BaseModel):
    quantity_change: int = Field(..., description="Positive for increase, negative for decrease")
    reason: Optional[str] = Field(None, max_length=255)


class InventoryTransactionResponse(BaseModel):
    id: int
    inventory_item_id: int
    transaction_type: str
    quantity_change: int
    previous_quantity: int
    new_quantity: int
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseListItemResponse(BaseModel):
    id: int
    inventory_item_id: int
    quantity_needed: int
    is_purchased: bool
    created_at: datetime
    inventory_item: InventoryItemResponse

    class Config:
        from_attributes = True


class PurchaseListResponse(BaseModel):
    merchant_name: str
    generated_date: datetime
    total_items: int
    total_quantity: int
    items: List[PurchaseListItemResponse]


class InventoryStatsResponse(BaseModel):
    total_items: int
    low_stock_items: int
    out_of_stock_items: int
    total_value: float
    categories: List[str]


class PurchaseListCreateRequest(BaseModel):
    inventory_item_id: int = Field(..., description="ID of the inventory item to add to purchase list")
    quantity_needed: int = Field(..., ge=1, description="Quantity needed for this item")
