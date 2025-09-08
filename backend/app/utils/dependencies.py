"""
FastAPI dependencies for authentication and authorization
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.merchant import Merchant
from app.models.user import User
from app.utils.auth import verify_token

# Security scheme
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    user_type: str = payload.get("user_type")
    email: str = payload.get("email")
    
    if user_id is None or user_type is None:
        raise credentials_exception
    
    return {
        "id": int(user_id),
        "user_type": user_type,
        "email": email
    }


def get_current_merchant(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Merchant:
    """Get current merchant, ensure user is a merchant"""
    if current_user["user_type"] != "merchant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Merchant access required"
        )
    
    merchant = db.query(Merchant).filter(Merchant.id == current_user["id"]).first()
    if merchant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchant not found"
        )
    
    return merchant


def get_current_consumer(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """Get current consumer/user, ensure user is a consumer"""
    if current_user["user_type"] != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Consumer access required"
        )
    
    user = db.query(User).filter(User.id == current_user["id"]).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[dict]:
    """Get current user if authenticated, otherwise return None"""
    if credentials is None:
        return None
    
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None
