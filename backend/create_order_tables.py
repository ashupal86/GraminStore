#!/usr/bin/env python3
"""
Script to create order tables in the database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import engine, Base
from app.models.order import Order, OrderItem

def create_order_tables():
    """Create order tables in the database"""
    try:
        # Create the tables
        Order.__table__.create(engine, checkfirst=True)
        OrderItem.__table__.create(engine, checkfirst=True)
        print("✅ Order tables created successfully!")
        return True
    except Exception as e:
        print(f"❌ Error creating order tables: {e}")
        return False

if __name__ == "__main__":
    create_order_tables()
