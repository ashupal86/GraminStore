"""
Dashboard routes for merchant and user analytics
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.models.database import get_db
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.models.transaction import (
    get_merchant_transaction_analytics, get_merchant_transactions, 
    get_merchant_transaction_table, TransactionType
)
from app.schemas.dashboard import (
    MerchantDashboardStats, UserDashboardStats, 
    ExpenseBreakdown
)
from app.utils.dependencies import get_current_merchant, get_current_consumer
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/merchant", response_model=MerchantDashboardStats)
async def get_merchant_dashboard(
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Number of days to include in dashboard statistics (1-365)", example=30)
):
    """Get comprehensive merchant dashboard statistics
    
    Returns merchant business analytics including:
    - Total sales and transaction counts
    - Pending payments summary
    - Average transaction value
    - Guest users count
    - Recent transactions list (last 10)
    
    Perfect for merchant dashboard overview and business insights.
    """
    try:
        # Get transaction analytics
        analytics = get_merchant_transaction_analytics(
            merchant_id=current_merchant.id,
            days=days
        )
        
        # Get guest users count
        guest_users_count = db.query(GuestUser).filter(
            GuestUser.merchant_id == current_merchant.id
        ).count()
        
        # Get recent transactions (last 10)
        recent_transactions_raw = get_merchant_transactions(
            merchant_id=current_merchant.id,
            limit=10,
            offset=0
        )
        
        recent_transactions = []
        for txn in recent_transactions_raw:
            recent_transactions.append({
                "transaction_id": txn[0],
                "user_id": txn[1],
                "guest_user_id": txn[2],
                "timestamp": txn[3].isoformat() if txn[3] else None,
                "amount": float(txn[4]),
                "type": txn[5],
                "description": txn[6],
                "payment_method": txn[7],
                "reference_number": txn[8]
            })
        
        return MerchantDashboardStats(
            total_sales=analytics["total_sales"],
            total_transactions=analytics["total_transactions"],
            total_pending=analytics["total_pending"],
            avg_transaction=analytics["avg_transaction"],
            guest_users_count=guest_users_count,
            recent_transactions=recent_transactions
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch merchant dashboard: {str(e)}"
        )


@router.get("/user", response_model=UserDashboardStats)
async def get_user_dashboard(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db)
):
    """Get comprehensive user dashboard statistics
    
    Returns user spending analytics including:
    - Total amount spent across all merchants
    - Total pending payments
    - Number of merchants transacted with
    - Weekly and monthly expense breakdowns
    
    Perfect for users to track their spending habits and payment obligations.
    """
    try:
        # Get all merchants to check transactions with each
        merchants = db.query(Merchant).all()
        
        total_spent = 0.0
        total_pending = 0.0
        merchants_count = 0
        weekly_expenses = []
        monthly_expenses = []
        
        # Calculate weekly and monthly date ranges
        today = datetime.utcnow().date()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        
        for merchant in merchants:
            merchant_transactions = get_merchant_transactions(
                merchant_id=merchant.id,
                limit=1000,  # Get more for calculation
                offset=0
            )
            
            merchant_spent = 0.0
            merchant_pending = 0.0
            merchant_weekly = 0.0
            merchant_monthly = 0.0
            has_transactions = False
            
            for txn in merchant_transactions:
                if txn[1] == current_user.id:  # user_id matches
                    has_transactions = True
                    amount = float(txn[4])
                    txn_date = txn[3].date() if txn[3] else today
                    
                    if txn[5] == TransactionType.PAYED:
                        merchant_spent += amount
                        total_spent += amount
                    else:
                        merchant_pending += amount
                        total_pending += amount
                    
                    # Weekly calculation
                    if txn_date >= week_start:
                        merchant_weekly += amount
                    
                    # Monthly calculation
                    if txn_date >= month_start:
                        merchant_monthly += amount
            
            if has_transactions:
                merchants_count += 1
                
                if merchant_weekly > 0:
                    weekly_expenses.append({
                        "merchant_id": merchant.id,
                        "merchant_name": merchant.name,
                        "amount": merchant_weekly
                    })
                
                if merchant_monthly > 0:
                    monthly_expenses.append({
                        "merchant_id": merchant.id,
                        "merchant_name": merchant.name,
                        "amount": merchant_monthly
                    })
        
        return UserDashboardStats(
            total_spent=total_spent,
            total_pending=total_pending,
            merchants_count=merchants_count,
            weekly_expenses=weekly_expenses,
            monthly_expenses=monthly_expenses
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user dashboard: {str(e)}"
        )


@router.get("/user/expenses", response_model=List[ExpenseBreakdown])
async def get_user_expense_breakdown(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db)
):
    """Get user's expense breakdown by merchant"""
    try:
        merchants = db.query(Merchant).all()
        expense_breakdown = []
        
        for merchant in merchants:
            merchant_transactions = get_merchant_transactions(
                merchant_id=merchant.id,
                limit=1000,
                offset=0
            )
            
            total_amount = 0.0
            paid_amount = 0.0
            pending_amount = 0.0
            transaction_count = 0
            last_transaction = None
            
            for txn in merchant_transactions:
                if txn[1] == current_user.id:  # user_id matches
                    transaction_count += 1
                    amount = float(txn[4])
                    total_amount += amount
                    
                    if txn[5] == TransactionType.PAYED:
                        paid_amount += amount
                    else:
                        pending_amount += amount
                    
                    # Track latest transaction
                    if not last_transaction or txn[3] > last_transaction:
                        last_transaction = txn[3]
            
            if transaction_count > 0:
                expense_breakdown.append(ExpenseBreakdown(
                    merchant_id=merchant.id,
                    merchant_name=merchant.name,
                    total_amount=total_amount,
                    paid_amount=paid_amount,
                    pending_amount=pending_amount,
                    transaction_count=transaction_count,
                    last_transaction=last_transaction
                ))
        
        # Sort by total amount descending
        expense_breakdown.sort(key=lambda x: x.total_amount, reverse=True)
        
        return expense_breakdown
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch expense breakdown: {str(e)}"
        )


@router.get("/merchant/top-customers", response_model=List[Dict[str, Any]])
async def get_top_customers(
    current_merchant: Merchant = Depends(get_current_merchant),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of top customers to return (1-50)", example=10)
):
    """Get top customers ranked by total transaction amount
    
    Returns a list of the merchant's best customers, including both registered users 
    and guest users, ranked by their total transaction amounts.
    
    Each customer entry includes:
    - Customer ID (user_id or guest_user_id)
    - Total transaction amount
    - Number of transactions
    - Customer type (registered or guest)
    
    Useful for merchant customer relationship management and loyalty programs.
    """
    try:
        transactions = get_merchant_transactions(
            merchant_id=current_merchant.id,
            limit=1000,  # Get more for calculation
            offset=0
        )
        
        # Aggregate by user
        user_stats = {}
        guest_stats = {}
        
        for txn in transactions:
            user_id = txn[1]
            guest_user_id = txn[2]
            amount = float(txn[4])
            
            if user_id:
                if user_id not in user_stats:
                    user_stats[user_id] = {
                        "user_id": user_id,
                        "total_amount": 0.0,
                        "transaction_count": 0,
                        "type": "registered"
                    }
                user_stats[user_id]["total_amount"] += amount
                user_stats[user_id]["transaction_count"] += 1
            
            elif guest_user_id:
                if guest_user_id not in guest_stats:
                    guest_stats[guest_user_id] = {
                        "guest_user_id": guest_user_id,
                        "total_amount": 0.0,
                        "transaction_count": 0,
                        "type": "guest"
                    }
                guest_stats[guest_user_id]["total_amount"] += amount
                guest_stats[guest_user_id]["transaction_count"] += 1
        
        # Combine and sort
        all_customers = list(user_stats.values()) + list(guest_stats.values())
        all_customers.sort(key=lambda x: x["total_amount"], reverse=True)
        
        return all_customers[:limit]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch top customers: {str(e)}"
        )
