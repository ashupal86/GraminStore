"""
Transaction schemas for request/response models
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Union
from datetime import datetime
from app.models.transaction import TransactionType, PaymentMethod, _map_frontend_to_enum


class TransactionCreate(BaseModel):
    """Transaction creation schema"""
    user_id: Optional[int] = Field(None, description="ID of registered user (for logged-in users)", example=123)
    amount: float = Field(..., gt=0, description="Transaction amount (must be positive)", example=25.50)
    type: TransactionType = Field(..., description="Transaction type: payed (completed) or pending (pay later). Note: Guest users can only use payed (immediate payment)")
    description: Optional[str] = Field(None, description="Transaction description/notes", example="Coffee and pastry")
    payment_method: Optional[PaymentMethod] = Field(None, description="Payment method: online or cash", example="cash")
    
    # Flag to indicate this is a guest transaction (auto-creates simplified guest user)
    is_guest_transaction: bool = Field(False, description="Set to true for guest transactions", example=True)
    
    @validator('type', pre=True)
    def map_frontend_type(cls, v):
        """Map frontend transaction type strings to enum values"""
        if isinstance(v, str):
            return _map_frontend_to_enum(v)
        return v


class TransactionResponse(BaseModel):
    """Transaction response schema"""
    transaction_id: int = Field(..., description="Unique transaction ID", example=789)
    user_id: Optional[int] = Field(None, description="User ID (for both registered and guest users)", example=123)
    timestamp: datetime = Field(..., description="Transaction timestamp", example="2024-01-15T14:30:00")
    amount: float = Field(..., description="Transaction amount", example=25.50)
    type: TransactionType = Field(..., description="Transaction type")
    description: Optional[str] = Field(None, description="Transaction description", example="Coffee and pastry")
    payment_method: Optional[PaymentMethod] = Field(None, description="Payment method", example="CASH")
    guest_user: bool = Field(False, description="True if guest user, false by default", example=True)


class TransactionAnalytics(BaseModel):
    """Transaction analytics response schema"""
    total_sales: float = Field(..., description="Total completed sales amount", example=15750.25)
    total_transactions: int = Field(..., description="Total number of transactions", example=245)
    total_pending: float = Field(..., description="Total pending payment amount", example=2340.80)
    avg_transaction: float = Field(..., description="Average transaction amount", example=64.29)


class GuestUserCreate(BaseModel):
    """Guest user creation schema - one per merchant"""
    merchant_id: int = Field(..., description="Merchant ID", example=123)


class GuestUserResponse(BaseModel):
    """Guest user response schema"""
    id: int = Field(..., description="Unique guest user ID (primary key)", example=456)
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    timestamp: datetime = Field(..., description="Creation timestamp", example="2024-01-15T10:30:00")
    
    class Config:
        from_attributes = True


class GuestUserWithTransactions(BaseModel):
    """Guest user with transaction details"""
    # Guest user fields
    id: int = Field(..., description="Unique guest user ID", example=456)
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    timestamp: datetime = Field(..., description="Guest user creation timestamp", example="2024-01-15T10:30:00")
    
    # Transaction details (fetched from transaction table)
    transaction_amount: Optional[float] = Field(None, description="Transaction amount", example=25.50)
    transaction_type: Optional[str] = Field(None, description="Transaction type (payed/pending)", example="payed")
    transaction_description: Optional[str] = Field(None, description="Transaction description", example="Coffee and snacks")
    transaction_date: Optional[datetime] = Field(None, description="Transaction timestamp", example="2024-01-20T14:30:00")
    payment_method: Optional[str] = Field(None, description="Payment method used", example="CASH")
    
    class Config:
        from_attributes = True
