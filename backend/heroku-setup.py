#!/usr/bin/env python3
"""
Heroku setup script for GraminStore backend
This script will be run after deployment to set up the database and seed data
"""

import os
import sys
import time
from sqlalchemy import create_engine, text
from app.models.database import Base, engine
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.models.transaction import load_existing_transaction_tables
from app.utils.auth import get_password_hash

def wait_for_database():
    """Wait for database to be ready"""
    print("🔄 Waiting for database to be ready...")
    
    for i in range(30):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✅ Database is ready!")
            return True
        except Exception as e:
            print(f"⏳ Attempt {i+1}/30: {e}")
            time.sleep(2)
    
    print("❌ Database not ready after 60 seconds")
    return False

def create_tables():
    """Create all database tables"""
    print("🏗️  Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

def create_admin_user():
    """Create admin user for SQLAdmin"""
    print("👤 Creating admin user...")
    
    admin_email = os.getenv("ADMIN_EMAIL", "admin@graminstore.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    try:
        with engine.connect() as conn:
            # Check if admin already exists
            result = conn.execute(text("SELECT id FROM merchants WHERE email = :email"), 
                                {"email": admin_email})
            if result.fetchone():
                print("✅ Admin user already exists!")
                return True
            
            # Create admin merchant
            conn.execute(text("""
                INSERT INTO merchants (name, email, phone, password_hash, aadhar_number, 
                                     business_name, city, state, zip_code, country, business_type, 
                                     created_at, updated_at)
                VALUES (:name, :email, :phone, :password_hash, :aadhar_number, 
                        :business_name, :city, :state, :zip_code, :country, :business_type,
                        NOW(), NOW())
            """), {
                "name": "Admin User",
                "email": admin_email,
                "phone": "+919876543210",
                "password_hash": get_password_hash(admin_password),
                "aadhar_number": "123456789012",
                "business_name": "GraminStore Admin",
                "city": "Mumbai",
                "state": "Maharashtra",
                "zip_code": "400001",
                "country": "India",
                "business_type": "Admin"
            })
            conn.commit()
            print(f"✅ Admin user created: {admin_email}")
            return True
    except Exception as e:
        print(f"❌ Error creating admin user: {e}")
        return False

def seed_fake_data():
    """Seed fake data for testing"""
    print("🌱 Seeding fake data...")
    try:
        # Import and run the fake data script
        from fake_data import main
        main()
        print("✅ Fake data seeded successfully!")
        return True
    except Exception as e:
        print(f"❌ Error seeding fake data: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Starting Heroku setup for GraminStore backend...")
    
    # Wait for database
    if not wait_for_database():
        sys.exit(1)
    
    # Create tables
    if not create_tables():
        sys.exit(1)
    
    # Load existing transaction tables
    try:
        load_existing_transaction_tables()
        print("✅ Transaction tables loaded!")
    except Exception as e:
        print(f"⚠️  Warning: Could not load transaction tables: {e}")
    
    # Create admin user
    if not create_admin_user():
        sys.exit(1)
    
    # Seed fake data
    if not seed_fake_data():
        print("⚠️  Warning: Fake data seeding failed, but continuing...")
    
    print("🎉 Heroku setup completed successfully!")
    print("\n📋 Admin Credentials:")
    print(f"   Email: {os.getenv('ADMIN_EMAIL', 'admin@graminstore.com')}")
    print(f"   Password: {os.getenv('ADMIN_PASSWORD', 'admin123')}")
    print("\n🔗 Access your app:")
    print("   API Docs: https://your-app-name.herokuapp.com/docs")
    print("   Admin Panel: https://your-app-name.herokuapp.com/admin")

if __name__ == "__main__":
    main()
