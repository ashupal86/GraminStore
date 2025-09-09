#!/usr/bin/env python3
"""
GraminStore Fake Data Generator
==============================

Comprehensive script to generate fake data for the GraminStore backend API.
This script creates merchants, users, and transactions with the simplified guest user system.

Usage:
    python fake_data.py

Features:
- Creates 5 merchants with realistic business data
- Creates 100+ users with Indian names and phone numbers
- Generates 100+ user transactions per merchant
- Generates 50+ guest transactions per merchant (using simplified guest user system)
- Creates admin user for testing
- Provides test credentials for API testing
"""

import sys
import os
import random
from datetime import datetime, timedelta
from faker import Faker

# Add the backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

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

# Initialize Faker with Indian locale for realistic data
fake = Faker(['en_IN'])

def create_admin_user():
    """Create admin user for testing"""
    print("👨‍💼 Creating admin user...")
    
    with SessionLocal() as session:
        # Check if admin already exists
        existing_admin = session.query(Merchant).filter(
            Merchant.email == "admin@graminstore.com"
        ).first()
        
        if existing_admin:
            print("   ✅ Admin user already exists")
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
        
        print(f"   ✅ Admin created: {admin.email} / admin123")
        return admin

def create_fake_merchants(count=5):
    """Create fake merchants with realistic Indian business data"""
    print(f"🏪 Creating {count} fake merchants...")
    
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
            
            print(f"   ✅ {merchant.business_name} - {merchant.email} / merchant123")
    
    return merchant_ids

def create_fake_users(count=100):
    """Create fake users with realistic Indian data"""
    print(f"👥 Creating {count} fake users...")
    
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
            
            if (i + 1) % 20 == 0:
                print(f"   ✅ Created {i + 1} users...")
    
    print(f"   ✅ Created {len(user_ids)} users total")
    return user_ids

def create_fake_transactions(merchant_ids, user_ids, user_transactions_per_merchant=100, guest_transactions_per_merchant=50):
    """Create fake transactions using the simplified guest user system"""
    print(f"💳 Creating fake transactions...")
    
    descriptions = [
        "Coffee and pastry", "Lunch special", "Grocery shopping", "Snacks", 
        "Tea and biscuits", "Breakfast combo", "Dinner", "Fresh vegetables",
        "Dairy products", "Beverages", "Sweets and treats", "Stationery items",
        "Phone recharge", "Medicine", "Cooking oil", "Rice and pulses"
    ]
    
    payment_methods = ["Cash", "UPI", "Card", "Digital Wallet", "Bank Transfer"]
    
    # Get fresh merchant data from database to avoid detached instance errors
    with SessionLocal() as session:
        fresh_merchants = session.query(Merchant).filter(Merchant.id.in_(merchant_ids)).all()
        
        for merchant_idx, merchant in enumerate(fresh_merchants, 1):
            print(f"  Processing merchant {merchant_idx}/{len(fresh_merchants)}: {merchant.business_name}")
            
            # 1. Create user transactions
            print(f"    Creating {user_transactions_per_merchant} user transactions...")
            for txn_num in range(user_transactions_per_merchant):
                if not user_ids:
                    break
                    
                user_id = random.choice(user_ids)
                amount = round(random.uniform(20.0, 1200.0), 2)
                transaction_type = random.choice([TransactionType.PAYED, TransactionType.PAY_LATER])
                description = random.choice(descriptions)
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
                        reference_number=f"USR_{merchant.id}_{str(fake.uuid4())[:8].upper()}",
                        timestamp=timestamp,
                        is_guest_transaction=False
                    )
                except Exception as e:
                    print(f"      Error creating user transaction: {e}")
                    continue
            
            # 2. Create guest transactions using simplified system
            print(f"    Creating {guest_transactions_per_merchant} guest transactions...")
            for txn_num in range(guest_transactions_per_merchant):
                # Guest transactions tend to be smaller amounts and more pay-later
                amount = round(random.uniform(10.0, 800.0), 2)
                transaction_type = random.choice([
                    TransactionType.PAYED, TransactionType.PAYED, TransactionType.PAY_LATER
                ])  # 2:1 ratio favoring paid transactions
                description = random.choice(descriptions)
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
                        reference_number=f"GST_{merchant.id}_{str(fake.uuid4())[:8].upper()}",
                        timestamp=timestamp,
                        is_guest_transaction=True  # This will auto-create guest user
                    )
                except Exception as e:
                    print(f"      Error creating guest transaction: {e}")
                    continue
            
            print(f"    ✅ Completed transactions for {merchant.business_name}")

def verify_data_counts():
    """Verify the generated data counts"""
    print("\n🔍 Verifying generated data...")
    
    with SessionLocal() as session:
        merchant_count = session.query(Merchant).count()
        user_count = session.query(User).count()
        guest_user_count = session.query(GuestUser).count()
        
        print(f"📊 Data Summary:")
        print(f"   Merchants: {merchant_count}")
        print(f"   Users: {user_count}")
        print(f"   Guest Users: {guest_user_count}")
        
        # Check transaction counts for first few merchants
        merchants = session.query(Merchant).limit(3).all()
        for merchant in merchants:
            try:
                all_transactions = get_merchant_transactions(
                    merchant_id=merchant.id, 
                    limit=10000, 
                    offset=0
                )
                
                if all_transactions:
                    user_transactions = [txn for txn in all_transactions if txn[1] is not None]
                    guest_transactions = [txn for txn in all_transactions if txn[2] is not None]
                    
                    print(f"\n📊 {merchant.business_name}:")
                    print(f"   Total transactions: {len(all_transactions)}")
                    print(f"   User transactions: {len(user_transactions)}")
                    print(f"   Guest transactions: {len(guest_transactions)}")
                    
                    # Count guest users for this merchant
                    merchant_guest_users = session.query(GuestUser).filter(
                        GuestUser.merchant_id == merchant.id
                    ).count()
                    print(f"   Guest users: {merchant_guest_users}")
                
            except Exception as e:
                print(f"   ❌ Error checking {merchant.business_name}: {e}")

def print_test_credentials():
    """Print test credentials for API testing"""
    print("\n🔑 Test Credentials for API Testing:")
    print("=" * 50)
    
    with SessionLocal() as session:
        # Get admin credentials
        admin = session.query(Merchant).filter(
            Merchant.email == "admin@graminstore.com"
        ).first()
        
        if admin:
            print(f"👨‍💼 Admin:")
            print(f"   Email: {admin.email}")
            print(f"   Password: admin123")
            print()
        
        # Get first few merchant credentials
        merchants = session.query(Merchant).filter(
            Merchant.email != "admin@graminstore.com"
        ).limit(3).all()
        
        print(f"🏪 Merchants (first 3):")
        for i, merchant in enumerate(merchants, 1):
            print(f"   {i}. {merchant.business_name}")
            print(f"      Email: {merchant.email}")
            print(f"      Password: merchant123")
            print()
        
        # Get first few user credentials
        users = session.query(User).limit(3).all()
        
        print(f"👥 Users (first 3):")
        for i, user in enumerate(users, 1):
            print(f"   {i}. {user.name}")
            print(f"      Email: {user.email}")
            print(f"      Password: user123")
            print()

def main():
    """Main function to run the fake data generation"""
    print("🚀 Starting GraminStore Fake Data Generation...")
    print("=" * 60)
    
    # Create database tables
    print("📊 Setting up database...")
    create_tables()
    print("✅ Database tables created/verified")
    
    # Create admin user
    admin = create_admin_user()
    
    # Create fake merchants
    merchant_ids = create_fake_merchants(count=5)
    
    # Create fake users
    user_ids = create_fake_users(count=100)
    
    # Create fake transactions
    create_fake_transactions(
        merchant_ids,
        user_ids,
        100,  # user_transactions_per_merchant
        50    # guest_transactions_per_merchant
    )
    
    # Verify data counts
    verify_data_counts()
    
    # Print test credentials
    print_test_credentials()
    
    print("\n🎉 Fake data generation completed successfully!")
    print("\nNext steps:")
    print("1. Start the FastAPI server: uvicorn app.main:app --reload --port=8001")
    print("2. Visit http://localhost:8001/docs for API documentation")
    print("3. Visit http://localhost:8001/admin for admin dashboard")
    print("4. Use the test credentials above for API testing")

if __name__ == "__main__":
    main()
