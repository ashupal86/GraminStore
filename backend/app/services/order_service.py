"""
Order service for managing marketplace orders
"""
from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem
from app.models.guest_user import GuestUser
from app.models.user import User
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

def create_order(
    db: Session,
    transaction_id: int,
    merchant_id: int,
    user_id: Optional[int],
    guest_user_id: Optional[int],
    customer_name: str,
    customer_phone: Optional[str],
    total_amount: float,
    payment_method: str,
    is_guest_order: bool,
    items: List[Dict[str, Any]]
) -> Order:
    """Create a new order with items"""
    
    # Generate unique order ID
    order_id = f"ORD_{merchant_id}_{uuid.uuid4().hex[:8].upper()}"
    
    # Create the order
    order = Order(
        order_id=order_id,
        transaction_id=transaction_id,
        merchant_id=merchant_id,
        user_id=user_id,
        guest_user_id=guest_user_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        total_amount=total_amount,
        payment_method=payment_method,
        is_guest_order=is_guest_order,
        status="pending"
    )
    
    db.add(order)
    db.flush()  # Get the order ID
    
    # Create order items
    for item in items:
        order_item = OrderItem(
            order_id=order.id,
            item_id=item.get("id", 0),
            item_name=item.get("name", "Unknown Item"),
            item_category=item.get("category", "general"),
            quantity=item.get("quantity", 1),
            unit=item.get("unit", "piece"),
            unit_price=item.get("unit_price", 0),
            total_price=item.get("unit_price", 0) * item.get("quantity", 1)
        )
        db.add(order_item)
    
    db.commit()
    db.refresh(order)
    
    return order

def get_merchant_orders(
    db: Session,
    merchant_id: int,
    limit: int = 50,
    offset: int = 0
) -> List[Order]:
    """Get orders for a specific merchant"""
    
    orders = db.query(Order)\
        .filter(Order.merchant_id == merchant_id)\
        .order_by(Order.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    return orders

def get_order_by_id(db: Session, order_id: str) -> Optional[Order]:
    """Get order by order ID"""
    return db.query(Order).filter(Order.order_id == order_id).first()

def update_order_status(
    db: Session,
    order_id: str,
    status: str
) -> Optional[Order]:
    """Update order status"""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if order:
        order.status = status
        order.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(order)
    return order

def get_order_with_items(db: Session, order_id: str) -> Optional[Dict[str, Any]]:
    """Get order with all items for API response"""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        return None
    
    # Get order items
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    
    return {
        "order_id": order.order_id,
        "transaction_id": order.transaction_id,
        "user_id": order.user_id,
        "merchant_id": order.merchant_id,
        "amount": order.total_amount,
        "items": [
            {
                "id": item.item_id,
                "name": item.item_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price,
                "category": item.item_category
            }
            for item in items
        ],
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "payment_method": order.payment_method,
        "is_guest_order": order.is_guest_order,
        "timestamp": order.created_at.isoformat(),
        "status": order.status
    }
