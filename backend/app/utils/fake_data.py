"""
Script to generate and insert fake data for testing
"""
import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session
from app.models.database import engine, SessionLocal
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.models.transaction import (
    create_merchant_transaction_table, insert_transaction, TransactionType
)
from app.utils.auth import get_password_hash

fake = Faker()


def create_fake_merchants(session: Session, count: int = 10):
    """Create fake merchants"""
    merchants = []
    
    for _ in range(count):
        merchant = Merchant(
            name=fake.name(),
            email=fake.unique.email(),
            phone=fake.unique.phone_number()[:15],
            password_hash=get_password_hash("password123"),
            aadhar_number=fake.unique.random_number(digits=12, fix_len=True),
            business_name=fake.company(),
            city=fake.city(),
            state=fake.state(),
            zip_code=fake.zipcode(),
            country="India",
            business_type=random.choice([
                "Grocery Store", "Electronics", "Clothing", "Pharmacy", 
                "Restaurant", "Hardware Store", "Book Store", "Bakery"
            ])
        )
        session.add(merchant)
        merchants.append(merchant)
    
    session.commit()
    
    # Create transaction tables for merchants
    for merchant in merchants:
        create_merchant_transaction_table(merchant.id)
    
    return merchants


def create_fake_users(session: Session, count: int = 50):
    """Create fake users"""
    users = []
    
    for _ in range(count):
        user = User(
            name=fake.name(),
            email=fake.unique.email(),
            phone=fake.unique.phone_number()[:15],
            password_hash=get_password_hash("password123")
        )
        session.add(user)
        users.append(user)
    
    session.commit()
    return users


def create_fake_guest_users(session: Session, merchants: list, count_per_merchant: int = 5):
    """Create fake guest users for each merchant"""
    guest_users = []
    
    for merchant in merchants:
        for i in range(count_per_merchant):
            guest_user = GuestUser(
                temporary_id=f"GUEST_{merchant.id}_{i+1:03d}",
                merchant_id=merchant.id,
                name=fake.name() if random.choice([True, False]) else None,
                phone=fake.phone_number()[:15] if random.choice([True, False]) else None
            )
            session.add(guest_user)
            guest_users.append(guest_user)
    
    session.commit()
    return guest_users


def create_fake_transactions(merchants: list, users: list, guest_users: list, count_per_merchant: int = 100):
    """Create fake transactions for merchants"""
    payment_methods = ["Cash", "Card", "UPI", "Bank Transfer", "Wallet"]
    descriptions = [
        "Grocery purchase", "Electronics item", "Clothing", "Medicine",
        "Food order", "Hardware items", "Books", "Bakery items",
        "Daily essentials", "Emergency purchase"
    ]
    
    for merchant in merchants:
        merchant_guest_users = [gu for gu in guest_users if gu.merchant_id == merchant.id]
        
        for _ in range(count_per_merchant):
            # Decide if this is a user transaction or guest transaction
            if random.choice([True, False]) and users:
                # User transaction
                user = random.choice(users)
                user_id = user.id
                guest_user_id = None
            else:
                # Guest transaction
                if merchant_guest_users:
                    guest_user = random.choice(merchant_guest_users)
                    user_id = None
                    guest_user_id = guest_user.id
                else:
                    continue
            
            # Generate transaction details
            amount = round(random.uniform(10.0, 1000.0), 2)
            transaction_type = random.choice([TransactionType.PAYED, TransactionType.PAY_LATER])
            description = random.choice(descriptions)
            payment_method = random.choice(payment_methods) if transaction_type == TransactionType.PAYED else None
            
            # Create transaction with random timestamp (last 30 days)
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(0, 23)
            minutes_ago = random.randint(0, 59)
            
            timestamp = datetime.utcnow() - timedelta(
                days=days_ago, 
                hours=hours_ago, 
                minutes=minutes_ago
            )
            
            # Insert transaction
            insert_transaction(
                merchant_id=merchant.id,
                user_id=user_id,
                guest_user_id=guest_user_id,
                amount=amount,
                transaction_type=transaction_type,
                description=description,
                payment_method=payment_method,
                reference_number=f"TXN_{merchant.id}_{fake.uuid4()[:8].upper()}"
            )


def insert_fake_data():
    """Main function to insert all fake data"""
    session = SessionLocal()
    
    try:
        print("Creating fake merchants...")
        merchants = create_fake_merchants(session, count=8)
        print(f"Created {len(merchants)} merchants")
        
        print("Creating fake users...")
        users = create_fake_users(session, count=30)
        print(f"Created {len(users)} users")
        
        print("Creating fake guest users...")
        guest_users = create_fake_guest_users(session, merchants, count_per_merchant=8)
        print(f"Created {len(guest_users)} guest users")
        
        print("Creating fake transactions...")
        create_fake_transactions(merchants, users, guest_users, count_per_merchant=150)
        print("Created fake transactions")
        
        print("Fake data insertion completed successfully!")
        
        # Print some sample login credentials
        print("\n" + "="*50)
        print("SAMPLE LOGIN CREDENTIALS:")
        print("="*50)
        print("Admin Dashboard: admin@admin.com / admin123")
        print("\nSample Merchants (all use password: password123):")
        for i, merchant in enumerate(merchants[:3]):
            print(f"  {i+1}. {merchant.email}")
        
        print("\nSample Users (all use password: password123):")
        for i, user in enumerate(users[:3]):
            print(f"  {i+1}. {user.email}")
        print("="*50)
        
    except Exception as e:
        print(f"Error inserting fake data: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    insert_fake_data()
