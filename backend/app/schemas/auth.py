"""
Authentication schemas for request/response models
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserRegister(BaseModel):
    """User registration schema"""
    name: str = Field(..., description="Full name of the user", example="John Doe")
    email: EmailStr = Field(..., description="Email address (must be unique)", example="john.doe@example.com")
    phone: str = Field(..., description="Phone number (must be unique)", example="+1234567890")
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)", example="securepass123")


class MerchantRegister(BaseModel):
    """Merchant registration schema"""
    name: str = Field(..., description="Full name of the merchant owner", example="Jane Smith")
    email: EmailStr = Field(..., description="Email address (must be unique)", example="jane.smith@example.com")
    phone: str = Field(..., description="Phone number (must be unique)", example="+1234567890")
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)", example="securepass123")
    aadhar_number: str = Field(..., description="12-digit Aadhaar number (must be unique)", example="123456789012")
    business_name: Optional[str] = Field(None, description="Name of the business/store", example="Smith Electronics")
    city: Optional[str] = Field(None, description="City where business is located", example="Mumbai")
    state: Optional[str] = Field(None, description="State where business is located", example="Maharashtra")
    zip_code: Optional[str] = Field(None, description="Postal/ZIP code", example="400001")
    country: Optional[str] = Field(None, description="Country (defaults to India)", example="India")
    business_type: Optional[str] = Field(None, description="Type of business", example="Electronics Store")


class UserLogin(BaseModel):
    """Login schema"""
    email: EmailStr = Field(..., description="Registered email address", example="john.doe@example.com")
    password: str = Field(..., description="Account password", example="securepass123")


class Token(BaseModel):
    """Token response schema"""
    access_token: str = Field(..., description="JWT access token for authentication")
    token_type: str = Field(..., description="Token type (always 'bearer')", example="bearer")
    user_type: str = Field(..., description="Type of user account", example="user")
    user_id: int = Field(..., description="Unique user ID", example=123)
    expires_in: int = Field(..., description="Token expiration time in seconds", example=1800)


class UserProfile(BaseModel):
    """User profile response schema"""
    id: int = Field(..., description="Unique user ID", example=123)
    name: str = Field(..., description="Full name of the user", example="John Doe")
    email: str = Field(..., description="Email address", example="john.doe@example.com")
    phone: str = Field(..., description="Phone number", example="+1234567890")
    user_type: str = Field(..., description="Account type", example="user")
    created_at: str = Field(..., description="Account creation timestamp", example="2024-01-15T10:30:00")
    
    class Config:
        from_attributes = True


class MerchantProfile(BaseModel):
    """Merchant profile response schema"""
    id: int = Field(..., description="Unique merchant ID", example=456)
    name: str = Field(..., description="Full name of the merchant", example="Jane Smith")
    email: str = Field(..., description="Email address", example="jane.smith@example.com")
    phone: str = Field(..., description="Phone number", example="+1234567890")
    aadhar_number: str = Field(..., description="12-digit Aadhaar number", example="123456789012")
    business_name: Optional[str] = Field(None, description="Business/store name", example="Smith Electronics")
    city: Optional[str] = Field(None, description="Business city", example="Mumbai")
    state: Optional[str] = Field(None, description="Business state", example="Maharashtra")
    zip_code: Optional[str] = Field(None, description="Business postal code", example="400001")
    country: Optional[str] = Field(None, description="Business country", example="India")
    business_type: Optional[str] = Field(None, description="Type of business", example="Electronics Store")
    user_type: str = Field(default="merchant", description="Account type", example="merchant")
    created_at: str = Field(..., description="Account creation timestamp", example="2024-01-15T10:30:00")
    
    class Config:
        from_attributes = True
