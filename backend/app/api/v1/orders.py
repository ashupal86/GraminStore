"""
Order processing routes for marketplace checkout
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models.database import get_db
from app.models.merchant import Merchant
from app.models.user import User
from app.models.transaction import insert_transaction, TransactionType, PaymentMethod
from app.utils.dependencies import get_current_merchant, get_current_consumer
from app.api.v1.websocket import notify_order_update
from app.utils.push_notifications import push_service
from app.services.order_service import create_order, get_merchant_orders, get_order_with_items, update_order_status
from datetime import datetime
import uuid

router = APIRouter(prefix="/orders", tags=["Orders"])


class CartItem(BaseModel):
    id: int
    name: str
    unit_price: float
    quantity: int
    unit: str
    merchant_id: int
    merchant_name: str
    category: str


class CheckoutRequest(BaseModel):
    cart_items: List[CartItem]
    payment_method: str = "online"  # "online" or "cash"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    is_guest_order: bool = True


class OrderResponse(BaseModel):
    order_id: str
    message: str
    total_amount: float
    items_count: int
    merchant_id: int
    timestamp: str


@router.post("/checkout", response_model=OrderResponse)
async def process_checkout(
    checkout_data: CheckoutRequest,
    db: Session = Depends(get_db)
):
    """Process marketplace checkout and create order/transaction"""
    try:
        print(f"DEBUG: Received checkout data: {checkout_data}")
        print(f"DEBUG: Cart items: {checkout_data.cart_items}")
        
        if not checkout_data.cart_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty"
            )
        
        # Group items by merchant
        merchant_orders = {}
        for item in checkout_data.cart_items:
            merchant_id = item.merchant_id
            if merchant_id not in merchant_orders:
                merchant_orders[merchant_id] = []
            merchant_orders[merchant_id].append(item)
        
        # Process orders for each merchant
        processed_orders = []
        for merchant_id, items in merchant_orders.items():
            # Calculate total amount for this merchant
            merchant_total = sum(item.unit_price * item.quantity for item in items)
            
            # Create order description
            items_description = ", ".join([
                f"{item.name} ({item.quantity} {item.unit})" 
                for item in items
            ])
            
            # Generate order ID
            order_id = f"ORD_{merchant_id}_{uuid.uuid4().hex[:8].upper()}"
            
            # Create transaction for this merchant's order
            transaction_id, user_id = insert_transaction(
                merchant_id=merchant_id,
                user_id=None,  # Will be set based on is_guest_order
                amount=merchant_total,
                transaction_type=TransactionType.PAYED,  # Marketplace orders are always paid
                description=f"Marketplace Order: {items_description}",
                payment_method=PaymentMethod(checkout_data.payment_method),
                is_guest_transaction=checkout_data.is_guest_order
            )
            
            # Create order in database
            order = create_order(
                db=db,
                transaction_id=transaction_id,
                merchant_id=merchant_id,
                user_id=user_id,
                guest_user_id=None,  # Will be set if guest order
                customer_name=checkout_data.customer_name or "Guest Customer",
                customer_phone=checkout_data.customer_phone,
                total_amount=merchant_total,
                payment_method=checkout_data.payment_method,
                is_guest_order=checkout_data.is_guest_order,
                items=[
                    {
                        "id": item.id,
                        "name": item.name,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "category": item.category
                    }
                    for item in items
                ]
            )
            
            # Prepare order data for websocket notification
            order_data = {
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
                    for item in order.items
                ],
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "payment_method": order.payment_method,
                "is_guest_order": order.is_guest_order,
                "timestamp": order.created_at.isoformat()
            }
            
            # Notify merchant about new order via websocket
            await notify_order_update(merchant_id, order_data)
            
            # Send push notification
            await push_service.send_order_notification(merchant_id, order_data)
            processed_orders.append({
                "order_id": order_id,
                "merchant_id": merchant_id,
                "amount": merchant_total,
                "items_count": len(items)
            })
        
        # Calculate total amount across all merchants
        total_amount = sum(order["amount"] for order in processed_orders)
        
        return OrderResponse(
            order_id=processed_orders[0]["order_id"] if processed_orders else "N/A",
            message=f"Order processed successfully for {len(processed_orders)} merchant(s)",
            total_amount=total_amount,
            items_count=len(checkout_data.cart_items),
            merchant_id=processed_orders[0]["merchant_id"] if processed_orders else 0,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process checkout: {str(e)}"
        )


@router.get("/merchant/{merchant_id}")
async def get_merchant_orders_api(
    merchant_id: int,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get orders for a specific merchant"""
    try:
        # Verify the merchant is requesting their own orders
        if current_merchant.id != merchant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get orders from database
        orders = get_merchant_orders(db, merchant_id, limit, offset)
        
        # Convert to API response format
        orders_data = []
        for order in orders:
            order_data = {
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
                    for item in order.items
                ],
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "payment_method": order.payment_method,
                "is_guest_order": order.is_guest_order,
                "timestamp": order.created_at.isoformat(),
                "status": order.status
            }
            orders_data.append(order_data)
        
        return {"orders": orders_data, "total": len(orders_data)}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch orders: {str(e)}"
        )


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    current_merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Update order status"""
    try:
        # Update order status in database
        from app.services.order_service import update_order_status as update_order_status_service
        order = update_order_status_service(db, order_id, status)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )
        
        # Verify the merchant owns this order
        if order.merchant_id != current_merchant.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        return {
            "order_id": order.order_id,
            "status": order.status,
            "message": "Order status updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update order status: {str(e)}"
        )


@router.get("/user/{user_id}")
async def get_user_orders(
    user_id: int,
    current_user: User = Depends(get_current_consumer),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
):
    """Get orders for a specific user"""
    try:
        # Verify the user is requesting their own orders
        if current_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get orders from database where user_id matches
        from app.services.order_service import get_merchant_orders
        from app.models.order import Order
        
        orders = db.query(Order)\
            .filter(Order.user_id == user_id)\
            .order_by(Order.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        # Convert to API response format
        orders_data = []
        for order in orders:
            order_data = {
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
                    for item in order.items
                ],
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "payment_method": order.payment_method,
                "is_guest_order": order.is_guest_order,
                "timestamp": order.created_at.isoformat(),
                "status": order.status
            }
            orders_data.append(order_data)
        
        return {"orders": orders_data, "total": len(orders_data)}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch user orders: {str(e)}"
        )


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: Dict[str, str]


@router.post("/push/subscribe")
async def subscribe_push_notifications(
    subscription_data: PushSubscriptionRequest,
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Subscribe merchant to push notifications"""
    try:
        push_service.subscribe_merchant(current_merchant.id, subscription_data.dict())
        return {
            "message": "Successfully subscribed to push notifications",
            "merchant_id": current_merchant.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to subscribe to push notifications: {str(e)}"
        )


@router.delete("/push/unsubscribe")
async def unsubscribe_push_notifications(
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Unsubscribe merchant from push notifications"""
    try:
        push_service.unsubscribe_merchant(current_merchant.id)
        return {
            "message": "Successfully unsubscribed from push notifications",
            "merchant_id": current_merchant.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unsubscribe from push notifications: {str(e)}"
        )
