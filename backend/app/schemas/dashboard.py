"""
Dashboard schemas for analytics and reporting
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from datetime import datetime


class MerchantDashboardStats(BaseModel):
    """Merchant dashboard statistics"""
    total_sales: float = Field(..., description="Total completed sales amount", example=15750.25)
    total_transactions: int = Field(..., description="Total number of transactions", example=245)
    total_pending: float = Field(..., description="Total pending payment amount", example=2340.80)
    avg_transaction: float = Field(..., description="Average transaction amount", example=64.29)
    guest_users_count: int = Field(..., description="Number of guest users created", example=12)
    recent_transactions: List[Dict[str, Any]] = Field(..., description="List of recent transactions (last 10)")


class UserDashboardStats(BaseModel):
    """User dashboard statistics"""
    total_spent: float = Field(..., description="Total amount spent across all merchants", example=3420.75)
    total_pending: float = Field(..., description="Total pending payment amount", example=580.25)
    merchants_count: int = Field(..., description="Number of merchants user has transacted with", example=8)
    weekly_expenses: List[Dict[str, Any]] = Field(..., description="Weekly expenses breakdown by merchant")
    monthly_expenses: List[Dict[str, Any]] = Field(..., description="Monthly expenses breakdown by merchant")


class TransactionHistory(BaseModel):
    """Transaction history for real-time updates"""
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    transactions: List[Dict[str, Any]] = Field(..., description="List of transactions")
    page: int = Field(..., description="Current page number", example=1)
    limit: int = Field(..., description="Number of transactions per page", example=50)
    total: int = Field(..., description="Total number of transactions", example=245)


class ExpenseBreakdown(BaseModel):
    """Expense breakdown by merchant"""
    merchant_id: int = Field(..., description="Merchant ID", example=123)
    merchant_name: str = Field(..., description="Merchant business name", example="Smith Electronics")
    total_amount: float = Field(..., description="Total transaction amount with this merchant", example=1250.75)
    paid_amount: float = Field(..., description="Total amount already paid", example=850.50)
    pending_amount: float = Field(..., description="Total pending payment amount", example=400.25)
    transaction_count: int = Field(..., description="Number of transactions with this merchant", example=15)
    last_transaction: datetime = Field(..., description="Timestamp of last transaction", example="2024-01-15T14:30:00")
