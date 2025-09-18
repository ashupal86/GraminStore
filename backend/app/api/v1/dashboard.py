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
    get_merchant_transaction_analytics, get_merchant_transactions, get_merchant_transactions_by_period,
    get_merchant_transaction_table, TransactionType, _map_transaction_type_from_db
)
from app.schemas.dashboard import (
    MerchantDashboardStats, UserDashboardStats, 
    ExpenseBreakdown
)
from app.utils.dependencies import get_current_merchant, get_current_consumer
from app.utils.cache import cache_result
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
        recent_transactions_raw = get_merchant_transactions_by_period(
            merchant_id=current_merchant.id,
            days=days,
            limit=10,
            offset=0
        )
        
        recent_transactions = []
        for txn in recent_transactions_raw:
            user_details = None
            if txn[1]:  # If user_id exists, get user details
                user = db.query(User).filter(User.id == txn[1]).first()
                if user:
                    # Get last 4 digits of phone
                    phone_last_4 = user.phone[-4:] if user.phone and len(user.phone) >= 4 else user.phone
                    user_details = {
                        "name": user.name,
                        "phone_last_4": phone_last_4,
                        "email": user.email
                    }
            
            recent_transactions.append({
                "transaction_id": txn[0],
                "user_id": txn[1],
                "timestamp": txn[2].isoformat() if txn[2] else None,
                "amount": float(txn[3]),
                "type": _map_transaction_type_from_db(txn[4]) if txn[4] else "payed",  # Map database type to frontend type
                # Debug: print(f"DB type: {txn[4]}, Mapped: {_map_transaction_type_from_db(txn[4])}")
                "description": txn[5],
                "payment_method": txn[6],
                "guest_user": txn[7],
                "user_details": user_details  # Added user details
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
                    amount = float(txn[3])
                    txn_date = txn[2].date() if txn[2] else today
                    
                    if txn[4] == TransactionType.PAYED:
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
                    amount = float(txn[3])
                    total_amount += amount
                    
                    if txn[4] == TransactionType.PAYED:
                        paid_amount += amount
                    else:
                        pending_amount += amount
                    
                    # Track latest transaction
                    if not last_transaction or txn[2] > last_transaction:
                        last_transaction = txn[2]
            
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
            is_guest = txn[7] is not None  # guest_user_id (convert to boolean)
            amount = float(txn[3])
            
            if user_id and not is_guest:  # Registered user
                if user_id not in user_stats:
                    user_stats[user_id] = {
                        "user_id": user_id,
                        "total_amount": 0.0,
                        "transaction_count": 0,
                        "type": "registered"
                    }
                user_stats[user_id]["total_amount"] += amount
                user_stats[user_id]["transaction_count"] += 1
            
            elif user_id and is_guest:  # Guest user
                if user_id not in guest_stats:
                    guest_stats[user_id] = {
                        "guest_user_id": user_id,
                        "total_amount": 0.0,
                        "transaction_count": 0,
                        "type": "guest"
                    }
                guest_stats[user_id]["total_amount"] += amount
                guest_stats[user_id]["transaction_count"] += 1
        
        # Combine and sort
        all_customers = list(user_stats.values()) + list(guest_stats.values())
        all_customers.sort(key=lambda x: x["total_amount"], reverse=True)
        
        return all_customers[:limit]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch top customers: {str(e)}"
        )


@router.get("/merchant/analytics/detailed", response_model=Dict[str, Any])
@cache_result(expiry_seconds=600, prefix="detailed_analytics")
async def get_detailed_analytics(
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db),
    period: str = Query("monthly", description="Analytics period: daily, weekly, monthly, yearly", example="monthly")
):
    """Get detailed analytics for merchant dashboard
    
    Returns comprehensive analytics including:
    - Sales trends over time
    - Transaction volume patterns
    - Payment method breakdown
    - Customer acquisition metrics
    - Revenue growth indicators
    """
    try:
        # Calculate date ranges based on period
        today = datetime.utcnow().date()
        
        if period == "daily":
            start_date = today
            end_date = today
        elif period == "weekly":
            start_date = today - timedelta(days=today.weekday())
            end_date = today
        elif period == "monthly":
            start_date = today.replace(day=1)
            end_date = today
        elif period == "yearly":
            start_date = today.replace(month=1, day=1)
            end_date = today
        else:
            start_date = today - timedelta(days=30)
            end_date = today
        
        # Get all transactions for the period
        transactions = get_merchant_transactions(
            merchant_id=current_merchant.id,
            limit=10000,  # Get more for detailed analysis
            offset=0
        )
        
        # Filter transactions by date range
        period_transactions = []
        for txn in transactions:
            txn_date = txn[2].date() if txn[2] else today
            if start_date <= txn_date <= end_date:
                period_transactions.append(txn)
        
        # Calculate detailed metrics
        total_sales = sum(float(txn[3]) for txn in period_transactions if txn[4] == TransactionType.PAYED)
        total_pending = sum(float(txn[3]) for txn in period_transactions if txn[4] == TransactionType.PAY_LATER)
        total_transactions = len(period_transactions)
        avg_transaction = total_sales / total_transactions if total_transactions > 0 else 0
        
        # Payment method breakdown
        payment_methods = {}
        for txn in period_transactions:
            method = txn[6] or 'UNKNOWN'
            amount = float(txn[3])
            if method not in payment_methods:
                payment_methods[method] = {'count': 0, 'amount': 0}
            payment_methods[method]['count'] += 1
            payment_methods[method]['amount'] += amount
        
        # Daily sales breakdown for the period
        daily_sales = {}
        for txn in period_transactions:
            if txn[4] == TransactionType.PAYED:
                txn_date = txn[2].date() if txn[2] else today
                date_str = txn_date.isoformat()
                if date_str not in daily_sales:
                    daily_sales[date_str] = 0
                daily_sales[date_str] += float(txn[3])
        
        # Customer metrics
        unique_customers = set()
        guest_customers = set()
        for txn in period_transactions:
            if txn[1] and not txn[7]:  # user_id and not guest
                unique_customers.add(txn[1])
            elif txn[1] and txn[7]:  # user_id and guest
                guest_customers.add(txn[1])
        
        # Growth metrics (compare with previous period)
        prev_start = start_date - (end_date - start_date + timedelta(days=1))
        prev_end = start_date - timedelta(days=1)
        
        prev_transactions = []
        for txn in transactions:
            txn_date = txn[2].date() if txn[2] else today
            if prev_start <= txn_date <= prev_end:
                prev_transactions.append(txn)
        
        prev_sales = sum(float(txn[3]) for txn in prev_transactions if txn[4] == TransactionType.PAYED)
        prev_count = len(prev_transactions)
        
        sales_growth = ((total_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
        transaction_growth = ((total_transactions - prev_count) / prev_count * 100) if prev_count > 0 else 0
        
        return {
            "period": period,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "summary": {
                "total_sales": total_sales,
                "total_pending": total_pending,
                "total_transactions": total_transactions,
                "avg_transaction": avg_transaction,
                "unique_customers": len(unique_customers),
                "guest_customers": len(guest_customers)
            },
            "growth": {
                "sales_growth_percent": round(sales_growth, 2),
                "transaction_growth_percent": round(transaction_growth, 2)
            },
            "payment_methods": payment_methods,
            "daily_sales": daily_sales,
            "top_customers": get_top_customers_for_period(period_transactions, 5)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch detailed analytics: {str(e)}"
        )


def get_top_customers_for_period(transactions, limit=5):
    """Helper function to get top customers for a specific period"""
    customer_stats = {}
    
    for txn in transactions:
        customer_id = txn[1]  # user_id (used for both registered and guest)
        if customer_id:
            if customer_id not in customer_stats:
                customer_stats[customer_id] = {
                    "customer_id": customer_id,
                    "total_amount": 0,
                    "transaction_count": 0,
                    "type": "registered" if not txn[7] else "guest"
                }
            customer_stats[customer_id]["total_amount"] += float(txn[3])
            customer_stats[customer_id]["transaction_count"] += 1
    
    # Sort by total amount and return top customers
    sorted_customers = sorted(customer_stats.values(), key=lambda x: x["total_amount"], reverse=True)
    return sorted_customers[:limit]


@router.get("/user/merchants", response_model=List[Dict[str, Any]])
async def get_user_merchants_with_pending(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db)
):
    """Get merchants the user has transacted with and their pending amounts
    
    Returns a list of merchants with:
    - Merchant details (name, business_name, city, state)
    - Total amount spent with each merchant
    - Total pending amount with each merchant
    - Transaction count
    - Last transaction date
    """
    try:
        merchants = db.query(Merchant).all()
        user_merchants = []
        
        for merchant in merchants:
            merchant_transactions = get_merchant_transactions(
                merchant_id=merchant.id,
                limit=1000,
                offset=0
            )
            
            total_spent = 0.0
            total_pending = 0.0
            transaction_count = 0
            last_transaction = None
            
            for txn in merchant_transactions:
                if txn[1] == current_user.id:  # user_id matches
                    transaction_count += 1
                    amount = float(txn[3])
                    
                    if txn[4] == TransactionType.PAYED:
                        total_spent += amount
                    else:
                        total_pending += amount
                    
                    # Track latest transaction
                    if not last_transaction or txn[2] > last_transaction:
                        last_transaction = txn[2]
            
            if transaction_count > 0:
                user_merchants.append({
                    "merchant_id": merchant.id,
                    "merchant_name": merchant.name,
                    "business_name": merchant.business_name or merchant.name,
                    "city": merchant.city,
                    "state": merchant.state,
                    "total_spent": total_spent,
                    "total_pending": total_pending,
                    "transaction_count": transaction_count,
                    "last_transaction": last_transaction.isoformat() if last_transaction else None
                })
        
        # Sort by total pending amount descending (highest pending first)
        user_merchants.sort(key=lambda x: x["total_pending"], reverse=True)
        
        return user_merchants
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user merchants: {str(e)}"
        )


@router.get("/user/spending-analytics", response_model=Dict[str, Any])
async def get_user_spending_analytics(
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
    period: str = Query("monthly", description="Analytics period: daily, weekly, monthly", example="monthly")
):
    """Get user spending analytics for different time periods
    
    Returns spending breakdown for:
    - Daily spending (last 7 days)
    - Weekly spending (last 4 weeks)
    - Monthly spending (last 12 months)
    """
    try:
        today = datetime.utcnow().date()
        
        # Get all merchants
        merchants = db.query(Merchant).all()
        
        # Initialize spending dictionaries
        daily_spending = {}
        weekly_spending = {}
        monthly_spending = {}
        
        # Calculate date ranges for each period
        daily_start = today - timedelta(days=6)  # Last 7 days including today
        weekly_start = today - timedelta(weeks=3)  # Last 4 weeks
        monthly_start = today.replace(day=1) - timedelta(days=365)  # Last 12 months
        
        for merchant in merchants:
            merchant_transactions = get_merchant_transactions(
                merchant_id=merchant.id,
                limit=1000,
                offset=0
            )
            
            for txn in merchant_transactions:
                if txn[1] == current_user.id and txn[4] == TransactionType.PAYED:
                    amount = float(txn[3])
                    txn_date = txn[2].date() if txn[2] else today
                    
                    # Daily spending (last 7 days)
                    if txn_date >= daily_start:
                        date_str = txn_date.isoformat()
                        if date_str not in daily_spending:
                            daily_spending[date_str] = 0
                        daily_spending[date_str] += amount
                    
                    # Weekly spending (last 4 weeks)
                    if txn_date >= weekly_start:
                        week_start = txn_date - timedelta(days=txn_date.weekday())
                        week_str = week_start.isoformat()
                        if week_str not in weekly_spending:
                            weekly_spending[week_str] = 0
                        weekly_spending[week_str] += amount
                    
                    # Monthly spending (last 12 months)
                    if txn_date >= monthly_start:
                        month_str = txn_date.strftime("%Y-%m")
                        if month_str not in monthly_spending:
                            monthly_spending[month_str] = 0
                        monthly_spending[month_str] += amount
        
        # Sort the dictionaries by date for better presentation
        daily_spending = dict(sorted(daily_spending.items()))
        weekly_spending = dict(sorted(weekly_spending.items()))
        monthly_spending = dict(sorted(monthly_spending.items()))
        
        return {
            "period": period,
            "daily_spending": daily_spending,
            "weekly_spending": weekly_spending,
            "monthly_spending": monthly_spending,
            "total_daily": sum(daily_spending.values()),
            "total_weekly": sum(weekly_spending.values()),
            "total_monthly": sum(monthly_spending.values())
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch spending analytics: {str(e)}"
        )


@router.get("/user/transactions/{merchant_id}", response_model=List[Dict[str, Any]])
async def get_user_transactions_by_merchant(
    merchant_id: int,
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of transactions to return", example=50),
    offset: int = Query(0, ge=0, description="Number of transactions to skip", example=0)
):
    """Get user's transactions with a specific merchant
    
    Returns detailed transaction history including:
    - Transaction amount and status
    - Payment method
    - Transaction date and time
    - Description
    """
    try:
        # Verify merchant exists
        merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
        if not merchant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merchant not found"
            )
        
        # Get transactions for this merchant
        merchant_transactions = get_merchant_transactions(
            merchant_id=merchant_id,
            limit=limit + offset,  # Get more to account for offset
            offset=0
        )
        
        user_transactions = []
        for txn in merchant_transactions:
            if txn[1] == current_user.id:  # user_id matches
                user_transactions.append({
                    "transaction_id": txn[0],
                    "amount": float(txn[3]),
                    "status": _map_transaction_type_from_db(txn[4]) if txn[4] else "payed",
                    "payment_method": txn[6],
                    "description": txn[5],
                    "datetime": txn[2].isoformat() if txn[2] else None,
                    "merchant_name": merchant.business_name or merchant.name
                })
        
        # Apply offset and limit
        user_transactions = user_transactions[offset:offset + limit]
        
        return user_transactions
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user transactions: {str(e)}"
        )

print("Server reloaded at", __import__("datetime").datetime.now())
