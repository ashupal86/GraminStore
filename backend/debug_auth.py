#!/usr/bin/env python3
"""
Debug script to test password authentication
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import get_db
from app.models.merchant import Merchant
from app.utils.auth import verify_password, get_password_hash

def test_merchant_auth():
    """Test merchant authentication"""
    print("🔍 Testing Merchant Authentication...")
    
    # Get database session
    db = next(get_db())
    
    # Test admin account
    admin = db.query(Merchant).filter(Merchant.email == 'admin@graminstore.com').first()
    if admin:
        print(f"✅ Admin found: {admin.name}")
        print(f"   Email: {admin.email}")
        print(f"   Password hash: {admin.password_hash[:50]}...")
        
        # Test admin password
        admin_valid = verify_password("admin123", admin.password_hash)
        print(f"   Admin password 'admin123' valid: {admin_valid}")
    else:
        print("❌ Admin not found")
    
    # Test merchant account
    merchant = db.query(Merchant).filter(Merchant.email == 'robert78@example.com').first()
    if merchant:
        print(f"\n✅ Merchant found: {merchant.name}")
        print(f"   Email: {merchant.email}")
        print(f"   Password hash: {merchant.password_hash[:50]}...")
        
        # Test merchant password
        merchant_valid = verify_password("merchant123", merchant.password_hash)
        print(f"   Merchant password 'merchant123' valid: {merchant_valid}")
        
        # Test with different passwords
        test_passwords = ["merchant123", "password123", "admin123", "test123"]
        for pwd in test_passwords:
            valid = verify_password(pwd, merchant.password_hash)
            print(f"   Password '{pwd}' valid: {valid}")
            
        # Generate new hash and test
        new_hash = get_password_hash("merchant123")
        new_valid = verify_password("merchant123", new_hash)
        print(f"   New hash for 'merchant123' valid: {new_valid}")
        
    else:
        print("❌ Merchant not found")
    
    # List first few merchants
    print(f"\n📋 First 5 merchants:")
    merchants = db.query(Merchant).limit(5).all()
    for i, m in enumerate(merchants, 1):
        print(f"   {i}. {m.name} - {m.email}")

if __name__ == "__main__":
    test_merchant_auth()
