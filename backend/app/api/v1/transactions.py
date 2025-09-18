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
    insert_transaction, get_merchant_transactions, get_merchant_transactions_by_period,
    get_merchant_transaction_analytics, get_guest_user_transaction_analytics, TransactionType, PaymentMethod, _map_transaction_type_from_db
)
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse, TransactionAnalytics,
    GuestUserCreate, GuestUserResponse, GuestUserWithTransactions
)
from app.utils.dependencies import get_current_merchant, get_current_consumer
from datetime import datetime
import uuid

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/simple", response_model=dict)
async def simple_create_transaction(transaction_data: TransactionCreate):
    """Simple transaction creation without dependencies for debugging"""
    print(f"DEBUG SIMPLE: Starting simple endpoint")
    print(f"DEBUG SIMPLE: transaction_data = {transaction_data}")
    try:
        print(f"DEBUG SIMPLE: Successfully received TransactionCreate object")
        return {
            "message": "Simple transaction endpoint works",
            "amount": transaction_data.amount,
            "type": str(transaction_data.type),
            "payment_method": str(transaction_data.payment_method),
            "description": transaction_data.description,
            "is_guest_transaction": transaction_data.is_guest_transaction
        }
    except Exception as e:
        print(f"DEBUG SIMPLE: Error = {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


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
    - IMPORTANT: Guest users can ONLY make immediate payments (PAYED type)
    
    Transaction types:
    - PAYED: Completed payment transaction (available for both registered and guest users)
    - PAY_LATER: Pending payment (credit/tab system) - ONLY available for registered users
    
    Automatically generates a reference number if not provided.
    Stores the transaction in the merchant's dedicated transaction table.
    """
    print(f"DEBUG: Function started, transaction_data type: {type(transaction_data)}")
    print(f"DEBUG: transaction_data: {transaction_data}")
    try:
        print(f"DEBUG: Transaction creation started")
        print(f"DEBUG: transaction_data = {transaction_data}")
        print(f"DEBUG: transaction_data.dict() = {transaction_data.dict()}")
        
        # Generate reference number for response
        reference_number = f"TXN_{current_merchant.id}_{uuid.uuid4().hex[:8].upper()}"
        print(f"DEBUG: Generated reference_number = {reference_number}")
        
        # Validate that either user_id or is_guest_transaction is provided
        if transaction_data.user_id is None and not transaction_data.is_guest_transaction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either user_id or is_guest_transaction=true must be provided"
            )
        
        # Restrict guest transactions to PAYED only (no pending for guests)
        if transaction_data.is_guest_transaction and transaction_data.type == TransactionType.PAY_LATER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Guest users can only make immediate payments (PAYED). Pending option is not available for guest transactions."
            )
        
        print(f"DEBUG: About to call insert_transaction")
        
        # Insert transaction into merchant-specific table
        transaction_id, user_id = insert_transaction(
            merchant_id=current_merchant.id,
            user_id=transaction_data.user_id,
            amount=transaction_data.amount,
            transaction_type=transaction_data.type,
            description=transaction_data.description,
            payment_method=transaction_data.payment_method,
            is_guest_transaction=transaction_data.is_guest_transaction
        )
        
        response = {
            "message": "Transaction created successfully",
            "transaction_id": transaction_id,
            "user_id": user_id,
            "merchant_id": current_merchant.id,
            "is_guest_transaction": transaction_data.is_guest_transaction
        }
        
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
    offset: int = Query(0, ge=0, description="Number of transactions to skip for pagination", example=0),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back (1-365)", example=30),
    db: Session = Depends(get_db)
):
    """Get transaction history for the current merchant
    
    Returns a paginated list of all transactions for the authenticated merchant.
    Includes both completed (PAYED) and pending (PAY_LATER) transactions.
    Now includes user details (name and phone) for registered users.
    """
    try:
        transactions = get_merchant_transactions_by_period(
            merchant_id=current_merchant.id,
            days=days,
            limit=limit,
            offset=offset
        )
        
        # Convert to dict format for response with user details
        transaction_list = []
        for txn in transactions:
            user_details = None
            if txn[1]:  # If user_id exists, get user details
                # Check if this is a guest transaction
                if txn[7] is not None:  # guest_user_id exists
                    user_details = {
                        "name": "Guest",
                        "phone_last_4": "****",
                        "email": "guest@merchant.local"
                    }
                else:
                    # Regular user transaction
                    user = db.query(User).filter(User.id == txn[1]).first()
                    if user:
                        # Get last 4 digits of phone
                        phone_last_4 = user.phone[-4:] if user.phone and len(user.phone) >= 4 else user.phone
                        user_details = {
                            "name": user.name,
                            "phone_last_4": phone_last_4,
                            "email": user.email
                        }
            
            transaction_list.append({
                "transaction_id": txn[0],  # transaction_id
                "user_id": txn[1],         # user_id
                "guest_user_id": txn[7],    # guest_user_id
                "timestamp": txn[2].isoformat() if txn[2] else None,  # timestamp
                "amount": float(txn[3]),   # amount
                "type": _map_transaction_type_from_db(txn[4]),  # Map database type to frontend type
                "description": txn[5],     # description
                "payment_method": txn[6],  # payment_method
                "guest_user": txn[7] is not None,  # guest_user_id (convert to boolean)
                "user_details": user_details  # Added user details
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
    """Create a guest user for the merchant (one per merchant only)
    
    Creates a guest user record for the merchant:
    - merchant_id: The merchant who owns this guest user
    - timestamp: When the guest user was created
    
    Only one guest user per merchant is allowed.
    This guest user can be used for multiple transactions.
    """
    # Check if guest user already exists for this merchant
    existing_guest = db.query(GuestUser).filter(
        GuestUser.merchant_id == current_merchant.id
    ).first()
    
    if existing_guest:
        return GuestUserResponse(
            id=existing_guest.id,
            merchant_id=existing_guest.merchant_id,
            timestamp=existing_guest.timestamp
        )
    
    # Create new guest user
    guest_user = GuestUser(merchant_id=current_merchant.id)
    
    db.add(guest_user)
    db.commit()
    db.refresh(guest_user)
    
    return GuestUserResponse(
        id=guest_user.id,
        merchant_id=guest_user.merchant_id,
        timestamp=guest_user.timestamp
    )


@router.get("/guest-users", response_model=List[GuestUserWithTransactions])
async def get_guest_users(
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Get guest user for the current merchant with their transaction details
    
    Returns the single guest user for the merchant along with all their transactions.
    Since there's only one guest user per merchant, this provides:
    - The guest user details
    - All transactions made by this guest user
    - Transactions sorted by date (most recent first)
    """
    # Get the single guest user for this merchant
    guest_user = db.query(GuestUser).filter(
        GuestUser.merchant_id == current_merchant.id
    ).first()
    
    if not guest_user:
        return []
    
    # Get all transactions for this guest user
    from app.models.transaction import get_merchant_transaction_table
    table = get_merchant_transaction_table(current_merchant.id)
    
    guest_users_with_transactions = []
    
    if table is not None:
        from sqlalchemy.orm import Session as SQLSession
        from app.models.database import engine
        
        with SQLSession(engine) as session:
            # Get all transactions for this guest user
            transaction_query = table.select().where(
                (table.c.user_id == guest_user.id) & (table.c.guest_user_id.isnot(None))
            ).order_by(table.c.timestamp.desc())
            transactions = session.execute(transaction_query).fetchall()
            
            for txn in transactions:
                guest_users_with_transactions.append(
                    GuestUserWithTransactions(
                        id=guest_user.id,
                        merchant_id=guest_user.merchant_id,
                        timestamp=guest_user.timestamp,
                        transaction_amount=float(txn[3]) if txn[3] else 0,
                        transaction_type=txn[4],
                        transaction_description=txn[5],
                        transaction_date=txn[2],
                        payment_method=txn[6]
                    )
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
                    "timestamp": txn[2].isoformat() if txn[2] else None,
                    "amount": float(txn[3]),
                    "type": _map_transaction_type_from_db(txn[4]),  # Map database type to frontend type
                    "description": txn[5],
                    "payment_method": txn[6],
                    "guest_user": txn[7] is not None
                })
        
        return user_transactions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user transactions: {str(e)}"
        )
