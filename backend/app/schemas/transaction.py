"""
Transaction schemas for request/response models
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    """Transaction creation schema"""
    user_id: Optional[int] = Field(None, description="ID of registered user (for logged-in users)", example=123)
    amount: float = Field(..., gt=0, description="Transaction amount (must be positive)", example=25.50)
    type: TransactionType = Field(..., description="Transaction type: PAYED (completed) or PAY_LATER (pending)")
    description: Optional[str] = Field(None, description="Transaction description/notes", example="Coffee and pastry")
    payment_method: Optional[str] = Field(None, description="Payment method used", example="UPI")
    reference_number: Optional[str] = Field(None, description="Custom reference number (auto-generated if not provided)", example="TXN_123_ABC12345")
    
    # Flag to indicate this is a guest transaction (auto-creates simplified guest user)
    is_guest_transaction: bool = Field(False, description="Set to true for guest transactions", example=True)


class TransactionResponse(BaseModel):
    """Transaction response schema"""
    transaction_id: int = Field(..., description="Unique transaction ID", example=789)
    user_id: Optional[int] = Field(None, description="Registered user ID", example=123)
    guest_user_id: Optional[int] = Field(None, description="Guest user ID", example=456)
    timestamp: datetime = Field(..., description="Transaction timestamp", example="2024-01-15T14:30:00")
    amount: float = Field(..., description="Transaction amount", example=25.50)
    type: TransactionType = Field(..., description="Transaction type")
    description: Optional[str] = Field(None, description="Transaction description", example="Coffee and pastry")
    payment_method: Optional[str] = Field(None, description="Payment method", example="UPI")
    reference_number: Optional[str] = Field(None, description="Transaction reference number", example="TXN_123_ABC12345")


class TransactionAnalytics(BaseModel):
    """Transaction analytics response schema"""
    total_sales: float = Field(..., description="Total completed sales amount", example=15750.25)
    total_transactions: int = Field(..., description="Total number of transactions", example=245)
    total_pending: float = Field(..., description="Total pending payment amount", example=2340.80)
    avg_transaction: float = Field(..., description="Average transaction amount", example=64.29)


class GuestUserCreate(BaseModel):
    """Simplified guest user creation schema"""
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    transaction_id: int = Field(..., description="Associated transaction ID", example=789)


class GuestUserResponse(BaseModel):
    """Simplified guest user response schema"""
    id: int = Field(..., description="Unique guest user ID (primary key)", example=456)
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    transaction_id: int = Field(..., description="Associated transaction ID", example=789)
    timestamp: datetime = Field(..., description="Creation timestamp", example="2024-01-15T10:30:00")
    
    class Config:
        from_attributes = True


class GuestUserWithTransactions(BaseModel):
    """Guest user with transaction details (simplified structure)"""
    # Guest user fields (simplified)
    id: int = Field(..., description="Unique guest user ID", example=456)
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    transaction_id: int = Field(..., description="Associated transaction ID", example=789)
    timestamp: datetime = Field(..., description="Guest user creation timestamp", example="2024-01-15T10:30:00")
    
    # Transaction details (fetched from transaction table)
    transaction_amount: Optional[float] = Field(None, description="Transaction amount", example=25.50)
    transaction_type: Optional[str] = Field(None, description="Transaction type (PAYED/PAY_LATER)", example="PAY_LATER")
    transaction_description: Optional[str] = Field(None, description="Transaction description", example="Coffee and snacks")
    transaction_date: Optional[datetime] = Field(None, description="Transaction timestamp", example="2024-01-20T14:30:00")
    payment_method: Optional[str] = Field(None, description="Payment method used", example="UPI")
    reference_number: Optional[str] = Field(None, description="Transaction reference number", example="GST_ABC123")
    
    class Config:
        from_attributes = True
