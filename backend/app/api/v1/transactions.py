"""
Transaction routes for managing payments and transaction history
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.models.transaction import (
    insert_transaction, get_merchant_transactions, 
    get_merchant_transaction_analytics, get_guest_user_transaction_analytics, TransactionType
)
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse, TransactionAnalytics,
    GuestUserCreate, GuestUserResponse, GuestUserWithTransactions
)
from app.utils.dependencies import get_current_merchant, get_current_consumer
from datetime import datetime
import uuid

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/create", response_model=dict)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Create a new transaction for the merchant
    
    Creates a transaction record for either:
    - A registered user (provide user_id)
    - A guest user (set is_guest_transaction=true - automatically creates simplified guest user)
    
    For guest transactions:
    - Each transaction creates a minimal guest user record with only essential fields
    - Guest user contains: id, merchant_id, transaction_id, timestamp
    - No personal information stored in guest_users table
    - Guest user is linked to the specific transaction via transaction_id
    
    Transaction types:
    - PAYED: Completed payment transaction
    - PAY_LATER: Pending payment (credit/tab system)
    
    Automatically generates a reference number if not provided.
    Stores the transaction in the merchant's dedicated transaction table.
    """
    try:
        # Generate reference number if not provided
        reference_number = transaction_data.reference_number
        if not reference_number:
            reference_number = f"TXN_{current_merchant.id}_{uuid.uuid4().hex[:8].upper()}"
        
        # Validate that either user_id or is_guest_transaction is provided
        if transaction_data.user_id is None and not transaction_data.is_guest_transaction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either user_id or is_guest_transaction=true must be provided"
            )
        
        # Insert transaction into merchant-specific table
        transaction_id, guest_user_id = insert_transaction(
            merchant_id=current_merchant.id,
            user_id=transaction_data.user_id,
            amount=transaction_data.amount,
            transaction_type=transaction_data.type,
            description=transaction_data.description,
            payment_method=transaction_data.payment_method,
            reference_number=reference_number,
            is_guest_transaction=transaction_data.is_guest_transaction
        )
        
        response = {
            "message": "Transaction created successfully",
            "transaction_id": transaction_id,
            "reference_number": reference_number,
            "merchant_id": current_merchant.id
        }
        
        # Add guest user info if it was created
        if guest_user_id:
            response["guest_user_id"] = guest_user_id
            response["guest_user_created"] = True
        
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create transaction: {str(e)}"
        )


@router.get("/history", response_model=List[dict])
async def get_transaction_history(
    current_merchant: Merchant = Depends(get_current_merchant),
    limit: int = Query(50, le=200, description="Maximum number of transactions to return (max 200)", example=50),
    offset: int = Query(0, ge=0, description="Number of transactions to skip for pagination", example=0)
):
    """Get transaction history for the current merchant
    
    Returns a paginated list of all transactions for the authenticated merchant.
    Includes both completed (PAYED) and pending (PAY_LATER) transactions.
    """
    try:
        transactions = get_merchant_transactions(
            merchant_id=current_merchant.id,
            limit=limit,
            offset=offset
        )
        
        # Convert to dict format for response
        transaction_list = []
        for txn in transactions:
            transaction_list.append({
                "transaction_id": txn[0],  # transaction_id
                "user_id": txn[1],         # user_id
                "guest_user_id": txn[2],   # guest_user_id
                "timestamp": txn[3].isoformat() if txn[3] else None,  # timestamp
                "amount": float(txn[4]),   # amount
                "type": txn[5],            # type
                "description": txn[6],     # description
                "payment_method": txn[7],  # payment_method
                "reference_number": txn[8] # reference_number
            })
        
        return transaction_list
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch transaction history: {str(e)}"
        )


@router.get("/analytics", response_model=TransactionAnalytics)
async def get_transaction_analytics(
    current_merchant: Merchant = Depends(get_current_merchant),
    days: int = Query(30, ge=1, le=365, description="Number of days to include in analytics (1-365)", example=30)
):
    """Get transaction analytics for the current merchant
    
    Returns comprehensive analytics including:
    - Total sales amount (completed transactions)
    - Total transaction count 
    - Total pending payments
    - Average transaction amount
    
    Analytics are calculated for the specified number of days from today.
    """
    try:
        analytics = get_merchant_transaction_analytics(
            merchant_id=current_merchant.id,
            days=days
        )
        
        return TransactionAnalytics(**analytics)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch analytics: {str(e)}"
        )


@router.post("/guest-user", response_model=GuestUserResponse)
async def create_guest_user(
    guest_data: GuestUserCreate,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Create a simplified guest user linked to a transaction
    
    Creates a minimal guest user record with only essential fields:
    - merchant_id: The merchant who owns this guest user
    - transaction_id: The specific transaction this guest user is linked to
    - timestamp: When the guest user was created
    
    This endpoint is typically used internally by the transaction creation process.
    Each guest user corresponds to exactly one transaction.
    
    Note: Guest users are now automatically created when creating guest transactions,
    so this endpoint is mainly for special cases or testing purposes.
    """
    # Validate that transaction_id is provided
    if not guest_data.transaction_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="transaction_id is required for guest user creation"
        )
    
    # Check if guest user already exists for this transaction
    existing_guest = db.query(GuestUser).filter(
        GuestUser.transaction_id == guest_data.transaction_id,
        GuestUser.merchant_id == guest_data.merchant_id
    ).first()
    
    if existing_guest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest user already exists for this transaction"
        )
    
    # Create new simplified guest user
    guest_user = GuestUser(
        merchant_id=guest_data.merchant_id,
        transaction_id=guest_data.transaction_id
    )
    
    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)
    
    return GuestUserResponse(
        id=guest_user.id,
        merchant_id=guest_user.merchant_id,
        transaction_id=guest_user.transaction_id,
        timestamp=guest_user.timestamp
    )


@router.get("/guest-users", response_model=List[GuestUserWithTransactions])
async def get_guest_users(
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Get all guest users for the current merchant with their transaction details
    
    Since each guest user now corresponds to exactly one transaction, this endpoint returns:
    - All guest users created by the merchant
    - Transaction details for each guest user (one-to-one relationship)
    - Guest users sorted by transaction date (most recent first)
    
    This new structure provides:
    - Better tracking of individual guest transactions
    - Clear customer identification per transaction
    - Simplified guest user management
    - Easy transaction-to-customer mapping
    
    Perfect for:
    - Viewing all guest transactions with customer details
    - Managing pay-later customers
    - Tracking individual guest purchases
    """
    guest_users = db.query(GuestUser).filter(
        GuestUser.merchant_id == current_merchant.id
    ).all()
    
    # Get transaction details for each guest user
    guest_users_with_transactions = []
    
    # Get the transaction table for this merchant
    from app.models.transaction import get_merchant_transaction_table
    table = get_merchant_transaction_table(current_merchant.id)
    
    if table is not None:
        from sqlalchemy.orm import Session as SQLSession
        from app.models.database import engine
        
        for guest in guest_users:
            # Get the associated transaction details
            transaction_details = None
            if guest.transaction_id:
                with SQLSession(engine) as session:
                    transaction_query = table.select().where(
                        table.c.transaction_id == guest.transaction_id
                    )
                    transaction_result = session.execute(transaction_query).fetchone()
                    
                    if transaction_result:
                        transaction_details = {
                            "amount": float(transaction_result[4]) if transaction_result[4] else 0,
                            "type": transaction_result[5],
                            "description": transaction_result[6],
                            "date": transaction_result[3],
                            "payment_method": transaction_result[7],
                            "reference_number": transaction_result[8]
                        }
            
            guest_users_with_transactions.append(
                GuestUserWithTransactions(
                    id=guest.id,
                    merchant_id=guest.merchant_id,
                    transaction_id=guest.transaction_id,
                    timestamp=guest.timestamp,
                    transaction_amount=transaction_details["amount"] if transaction_details else None,
                    transaction_type=transaction_details["type"] if transaction_details else None,
                    transaction_description=transaction_details["description"] if transaction_details else None,
                    transaction_date=transaction_details["date"] if transaction_details else None,
                    payment_method=transaction_details["payment_method"] if transaction_details else None,
                    reference_number=transaction_details["reference_number"] if transaction_details else None
                )
            )
    else:
        # If no transaction table, return guest users without transaction details
        for guest in guest_users:
            guest_users_with_transactions.append(
                GuestUserWithTransactions(
                    id=guest.id,
                    merchant_id=guest.merchant_id,
                    transaction_id=guest.transaction_id,
                    timestamp=guest.timestamp,
                    transaction_amount=None,
                    transaction_type=None,
                    transaction_description=None,
                    transaction_date=None,
                    payment_method=None,
                    reference_number=None
                )
            )
    
    # Sort by transaction date (most recent first), then by timestamp
    guest_users_with_transactions.sort(
        key=lambda x: x.transaction_date or x.timestamp, 
        reverse=True
    )
    
    return guest_users_with_transactions


@router.get("/user-transactions/{merchant_id}", response_model=List[dict])
async def get_user_transactions_with_merchant(
    merchant_id: int = Path(..., description="ID of the merchant to get transactions with", example=123),
    current_user: User = Depends(get_current_consumer),
    limit: int = Query(50, le=200, description="Maximum number of transactions to return (max 200)", example=50),
    offset: int = Query(0, ge=0, description="Number of transactions to skip for pagination", example=0)
):
    """Get user's transaction history with a specific merchant
    
    Returns all transactions between the authenticated user and the specified merchant.
    Useful for users to see their purchase history with individual stores.
    """
    try:
        transactions = get_merchant_transactions(
            merchant_id=merchant_id,
            limit=limit,
            offset=offset
        )
        
        # Filter transactions for the current user
        user_transactions = []
        for txn in transactions:
            if txn[1] == current_user.id:  # user_id matches
                user_transactions.append({
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
        
        return user_transactions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user transactions: {str(e)}"
        )
