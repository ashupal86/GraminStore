"""
User model for consumers
"""
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class User(BaseModel):
    """User model for consumers/customers"""
    __tablename__ = "users"
    
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    # Relationships
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan", lazy="select")
    
    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}', email='{self.email}')>"
