"""
Admin API endpoints for database management
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import sys
import os
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from app.models.database import SessionLocal, create_tables
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.models.transaction import (
    insert_transaction, TransactionType, 
    create_merchant_transaction_table, get_merchant_transactions
)
from app.utils.auth import get_password_hash
from app.config import settings

# Create router
router = APIRouter(prefix="/admin", tags=["admin"])

def create_admin_user():
    """Create admin user for testing"""
    with SessionLocal() as session:
        # Check if admin already exists
        existing_admin = session.query(Merchant).filter(
            Merchant.email == "admin@graminstore.com"
        ).first()
        
        if existing_admin:
            return existing_admin
        
        admin = Merchant(
            name="Admin User",
            email="admin@graminstore.com",
            phone="+91-9876543210",
            password_hash=get_password_hash("admin123"),
            aadhar_number="123456789012",
            business_name="GraminStore Admin",
            city="Mumbai",
            state="Maharashtra",
            zip_code="400001",
            country="India",
            business_type="Admin"
        )
        
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return admin

def create_test_merchant():
    """Create a test merchant for easy login"""
    with SessionLocal() as session:
        # Check if test merchant already exists
        existing_merchant = session.query(Merchant).filter(
            Merchant.email == "test@example.com"
        ).first()
        
        if existing_merchant:
            return existing_merchant
        
        test_merchant = Merchant(
            name="Test Merchant",
            email="test@example.com",
            phone="+91-9999999999",
            password_hash=get_password_hash("Merchant123"),
            aadhar_number="999999999999",
            business_name="Test Store",
            city="Mumbai",
            state="Maharashtra",
            zip_code="400001",
            country="India",
            business_type="retail"
        )
        
        session.add(test_merchant)
        session.commit()
        session.refresh(test_merchant)
        return test_merchant

def create_fake_merchants(count=2):
    """Create fake merchants with realistic Indian business data"""
    from faker import Faker
    import random
    
    fake = Faker(['en_IN'])
    
    business_types = [
        "Grocery Store", "General Store", "Medical Store", "Electronics Store", 
        "Clothing Store", "Hardware Store", "Stationery Store", "Book Store",
        "Restaurant", "Cafe", "Bakery", "Pharmacy"
    ]
    
    indian_cities = [
        ("Mumbai", "Maharashtra", "400001"),
        ("Delhi", "Delhi", "110001"),
        ("Bangalore", "Karnataka", "560001"),
        ("Chennai", "Tamil Nadu", "600001"),
        ("Kolkata", "West Bengal", "700001"),
        ("Hyderabad", "Telangana", "500001"),
        ("Pune", "Maharashtra", "411001"),
        ("Ahmedabad", "Gujarat", "380001"),
        ("Jaipur", "Rajasthan", "302001"),
        ("Lucknow", "Uttar Pradesh", "226001")
    ]
    
    merchant_ids = []
    
    with SessionLocal() as session:
        for i in range(count):
            city, state, zip_code = random.choice(indian_cities)
            
            merchant = Merchant(
                name=fake.name(),
                email=fake.unique.email(),
                phone=fake.phone_number(),
                password_hash=get_password_hash("merchant123"),
                aadhar_number=fake.random_number(digits=12),
                business_name=f"{fake.company()} {random.choice(['Store', 'Shop', 'Mart', 'Center'])}",
                city=city,
                state=state,
                zip_code=zip_code,
                country="India",
                business_type=random.choice(business_types)
            )
            
            session.add(merchant)
            session.commit()
            session.refresh(merchant)
            merchant_ids.append(merchant.id)
    
    return merchant_ids

def create_fake_users(count=4):
    """Create fake users with realistic Indian data"""
    from faker import Faker
    fake = Faker(['en_IN'])
    
    user_ids = []
    
    with SessionLocal() as session:
        for i in range(count):
            user = User(
                name=fake.name(),
                email=fake.unique.email(),
                phone=fake.phone_number(),
                password_hash=get_password_hash("user123")
            )
            
            session.add(user)
            session.commit()
            session.refresh(user)
            user_ids.append(user.id)
    
    return user_ids

def create_fake_transactions(merchant_ids, user_ids, user_transactions_per_merchant=50, guest_transactions_per_merchant=50):
    """Create fake transactions using the simplified guest user system"""
    from faker import Faker
    import random
    from datetime import datetime, timedelta
    
    fake = Faker(['en_IN'])
    
    descriptions = [
        "Coffee and pastry", "Lunch special", "Grocery shopping", "Snacks", 
        "Tea and biscuits", "Breakfast combo", "Dinner", "Fresh vegetables",
        "Dairy products", "Beverages", "Sweets and treats", "Stationery items",
        "Phone recharge", "Medicine", "Cooking oil", "Rice and pulses",
        "Bread and butter", "Milk and eggs", "Fruits", "Vegetables",
        "Spices and condiments", "Cleaning supplies", "Personal care items",
        "School supplies", "Office supplies", "Electronics accessories",
        "Clothing items", "Footwear", "Home decor", "Kitchen utensils"
    ]
    
    payment_methods = ["cash", "online"]
    
    # Get fresh merchant data from database to avoid detached instance errors
    with SessionLocal() as session:
        fresh_merchants = session.query(Merchant).filter(Merchant.id.in_(merchant_ids)).all()
        
        for merchant in fresh_merchants:
            # 1. Create user transactions
            for txn_num in range(user_transactions_per_merchant):
                if not user_ids:
                    break
                    
                user_id = random.choice(user_ids)
                # More realistic amount distribution
                amount = round(random.uniform(50.0, 2000.0), 2)
                transaction_type = random.choice([TransactionType.PAYED, TransactionType.PAY_LATER])
                # Make description optional (30% chance of no description)
                description = random.choice(descriptions) if random.random() > 0.3 else None
                payment_method = random.choice(payment_methods) if transaction_type == TransactionType.PAYED else None
                
                # Random timestamp within last 90 days
                days_ago = random.randint(0, 90)
                hours_ago = random.randint(8, 22)
                minutes_ago = random.randint(0, 59)
                
                timestamp = datetime.utcnow() - timedelta(
                    days=days_ago, 
                    hours=hours_ago, 
                    minutes=minutes_ago
                )
                
                try:
                    insert_transaction(
                        merchant_id=merchant.id,
                        user_id=user_id,
                        amount=amount,
                        transaction_type=transaction_type,
                        description=description,
                        payment_method=payment_method,
                        timestamp=timestamp,
                        is_guest_transaction=False
                    )
                except Exception as e:
                    continue
            
            # 2. Create guest transactions using simplified system
            for txn_num in range(guest_transactions_per_merchant):
                # Guest transactions tend to be smaller amounts and are always immediate payment
                amount = round(random.uniform(25.0, 500.0), 2)
                transaction_type = TransactionType.PAYED  # Guest users can only pay immediately
                # Make description optional (40% chance of no description for guests)
                description = random.choice(descriptions) if random.random() > 0.4 else None
                payment_method = random.choice(payment_methods) if transaction_type == TransactionType.PAYED else None
                
                # Random timestamp within last 60 days (guests are more recent)
                days_ago = random.randint(0, 60)
                hours_ago = random.randint(9, 21)
                minutes_ago = random.randint(0, 59)
                
                timestamp = datetime.utcnow() - timedelta(
                    days=days_ago, 
                    hours=hours_ago, 
                    minutes=minutes_ago
                )
                
                try:
                    insert_transaction(
                        merchant_id=merchant.id,
                        user_id=None,  # No user for guest transactions
                        amount=amount,
                        transaction_type=transaction_type,
                        description=description,
                        payment_method=payment_method,
                        timestamp=timestamp,
                        is_guest_transaction=True  # This will auto-create guest user
                    )
                except Exception as e:
                    continue

@router.post("/populate-database")
async def populate_database():
    """Populate the database with fake data for testing"""
    try:
        # Create database tables
        create_tables()
        
        # Create admin user
        admin = create_admin_user()
        
        # Create test merchant for easy login
        test_merchant = create_test_merchant()
        
        # Create fake merchants
        merchant_ids = create_fake_merchants(count=2)
        
        # Create fake users
        user_ids = create_fake_users(count=4)
        
        # Create fake transactions
        create_fake_transactions(
            merchant_ids,
            user_ids,
            50,  # user_transactions_per_merchant
            50   # guest_transactions_per_merchant
        )
        
        # Get final counts
        with SessionLocal() as session:
            merchant_count = session.query(Merchant).count()
            user_count = session.query(User).count()
            guest_user_count = session.query(GuestUser).count()
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "Database populated successfully!",
                "data": {
                    "merchants": merchant_count,
                    "users": user_count,
                    "guest_users": guest_user_count,
                    "timestamp": datetime.utcnow().isoformat()
                },
                "test_credentials": {
                    "admin": {
                        "email": "admin@graminstore.com",
                        "password": "admin123"
                    },
                    "test_merchant": {
                        "email": "test@example.com",
                        "password": "Merchant123"
                    },
                    "merchants": {
                        "password": "merchant123"
                    },
                    "users": {
                        "password": "user123"
                    }
                }
            }
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Error populating database: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )

@router.get("/database-status")
async def get_database_status():
    """Get current database status and counts"""
    try:
        with SessionLocal() as session:
            merchant_count = session.query(Merchant).count()
            user_count = session.query(User).count()
            guest_user_count = session.query(GuestUser).count()
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "data": {
                        "merchants": merchant_count,
                        "users": user_count,
                        "guest_users": guest_user_count,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                }
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Error getting database status: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
