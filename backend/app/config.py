"""
Configuration settings for GraminStore Backend API
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    database_url: str = "postgresql://postgres:postgres123@localhost:5432/graminstore"
    
    # JWT Configuration
    secret_key: str = "your-super-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Admin Configuration
    admin_username: str = "admin"
    admin_password: str = "admin123"
    
    # Application Configuration
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8001
    
    # CORS Configuration
    cors_origins: list = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
