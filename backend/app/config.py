"""
Configuration settings for GraminStore Backend API
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@localhost:5432/graminstore")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Fix Heroku DATABASE_URL format (postgres:// -> postgresql://)
        if self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace("postgres://", "postgresql://", 1)
    
    # JWT Configuration
    secret_key: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Admin Configuration
    admin_username: str = os.getenv("ADMIN_EMAIL", "admin")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "admin123")
    
    # Application Configuration
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8009
    
    # CORS Configuration
    cors_origins: list = [
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://localhost:5173",
        "http://192.168.1.10:3000",
        "http://192.168.1.10:3001", 
        "http://192.168.1.10:5173",
        "http://192.168.1.10:8009"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
