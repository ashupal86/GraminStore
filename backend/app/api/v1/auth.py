"""
Authentication routes for user and merchant login/registration
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.models.merchant import Merchant
from app.models.user import User
from app.models.transaction import create_merchant_transaction_table
from app.schemas.auth import (
    UserRegister, MerchantRegister, UserLogin, Token, 
    UserProfile, MerchantProfile
)
from app.utils.auth import verify_password, get_password_hash, create_user_token
from app.utils.dependencies import get_current_merchant, get_current_consumer
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/merchant", response_model=Token)
async def register_merchant(
    merchant_data: MerchantRegister,
    db: Session = Depends(get_db)
):
    """Register a new merchant account
    
    Creates a new merchant account with business details and automatically:
    - Generates a unique merchant ID
    - Creates a dedicated transaction table for the merchant
    - Returns a JWT token for immediate authentication
    
    All merchant emails and phone numbers must be unique.
    """
    # Check if merchant already exists
    existing_merchant = db.query(Merchant).filter(
        (Merchant.email == merchant_data.email) | 
        (Merchant.phone == merchant_data.phone)
    ).first()
    
    if existing_merchant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Merchant with this email or phone already exists"
        )
    
    # Create new merchant
    merchant = Merchant(
        name=merchant_data.name,
        email=merchant_data.email,
        phone=merchant_data.phone,
        password_hash=get_password_hash(merchant_data.password),
        aadhar_number=merchant_data.aadhar_number,
        business_name=merchant_data.business_name,
        city=merchant_data.city,
        state=merchant_data.state,
        zip_code=merchant_data.zip_code,
        country=merchant_data.country,
        business_type=merchant_data.business_type
    )
    
    db.add(merchant)
    db.commit()
    db.refresh(merchant)
    
    # Create transaction table for the merchant
    create_merchant_transaction_table(merchant.id)
    
    # Create access token
    access_token = create_user_token(merchant.id, "merchant", merchant.email)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="merchant",
        user_id=merchant.id,
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/register/user", response_model=Token)
async def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register a new user/consumer account
    
    Creates a new user account for customers who want to:
    - Track their transactions across multiple merchants
    - View spending analytics and history
    - Manage pending payments
    
    Returns a JWT token for immediate authentication.
    All user emails and phone numbers must be unique.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.email == user_data.email) | 
        (User.phone == user_data.phone)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or phone already exists"
        )
    
    # Create new user
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=get_password_hash(user_data.password)
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create access token
    access_token = create_user_token(user.id, "user", user.email)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="user",
        user_id=user.id,
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/login/merchant", response_model=Token)
async def login_merchant(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """Merchant login authentication
    
    Authenticates a merchant using email and password.
    Returns a JWT token that provides access to:
    - Transaction management
    - Business analytics dashboard  
    - Customer management
    - Guest user creation
    
    Token expires in 30 minutes by default.
    """
    merchant = db.query(Merchant).filter(Merchant.email == login_data.email).first()
    
    if not merchant or not verify_password(login_data.password, merchant.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_user_token(merchant.id, "merchant", merchant.email)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="merchant",
        user_id=merchant.id,
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.post("/login/user", response_model=Token)
async def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """User/consumer login authentication
    
    Authenticates a user using email and password.
    Returns a JWT token that provides access to:
    - Personal spending dashboard
    - Transaction history with merchants
    - Expense analytics and breakdowns
    - Account profile management
    
    Token expires in 30 minutes by default.
    """
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_user_token(user.id, "user", user.email)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_type="user",
        user_id=user.id,
        expires_in=settings.access_token_expire_minutes * 60
    )


@router.get("/profile/merchant", response_model=MerchantProfile)
async def get_merchant_profile(
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get current merchant profile information
    
    Returns complete merchant profile including:
    - Personal details (name, email, phone)
    - Business information (name, type, location)
    - Account metadata (creation date, merchant ID)
    
    Requires valid merchant authentication token.
    """
    return MerchantProfile(
        id=current_merchant.id,
        name=current_merchant.name,
        email=current_merchant.email,
        phone=current_merchant.phone,
        aadhar_number=current_merchant.aadhar_number,
        business_name=current_merchant.business_name,
        city=current_merchant.city,
        state=current_merchant.state,
        zip_code=current_merchant.zip_code,
        country=current_merchant.country,
        business_type=current_merchant.business_type,
        created_at=current_merchant.created_at.isoformat()
    )


@router.get("/profile/user", response_model=UserProfile)
async def get_user_profile(
    current_user: User = Depends(get_current_consumer)
):
    """Get current user profile information
    
    Returns complete user profile including:
    - Personal details (name, email, phone)
    - Account metadata (creation date, user ID)
    - Account type information
    
    Requires valid user authentication token.
    """
    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        user_type="user",
        created_at=current_user.created_at.isoformat()
    )



@router.get("/search/users-by-phone", response_model=List[dict])
async def search_users_by_phone(
    phone: str = Query(..., min_length=5, description="Partial phone number to search"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results to return"),
    db: Session = Depends(get_db)
):
    """Search for platform users by partial phone number.
    Returns a list of matching users."""
    # Remove any non-digit characters for searching
    clean_phone = ''.join(filter(str.isdigit, phone))
    
    if len(clean_phone) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Phone number must be at least 5 digits"
        )
    
    # Search for users whose phone contains the search digits
    users = db.query(User).filter(
        User.phone.like(f"%{clean_phone}%")
    ).limit(limit).all()
    
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone
        }
        for user in users
    ]

@router.get("/lookup/user-by-phone", response_model=dict)
async def lookup_user_by_phone(
    phone: str = Query(..., min_length=5, description="User phone number to lookup"),
    db: Session = Depends(get_db)
):
    """Lookup a platform user by exact phone number and return basic profile info.
    Returns 404 if not found."""
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
      raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return {
      "id": user.id,
      "name": user.name,
      "email": user.email,
      "phone": user.phone
    }
