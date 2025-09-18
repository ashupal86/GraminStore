"""
Push notification utilities for order updates
"""
import asyncio
import json
from typing import Dict, Any, Optional
from datetime import datetime

class PushNotificationService:
    """Simple push notification service"""
    
    def __init__(self):
        self.subscriptions: Dict[int, Dict[str, Any]] = {}
    
    def subscribe_merchant(self, merchant_id: int, subscription_data: Dict[str, Any]):
        """Subscribe a merchant to push notifications"""
        self.subscriptions[merchant_id] = {
            **subscription_data,
            'subscribed_at': datetime.utcnow().isoformat()
        }
        print(f"Merchant {merchant_id} subscribed to push notifications")
    
    def unsubscribe_merchant(self, merchant_id: int):
        """Unsubscribe a merchant from push notifications"""
        if merchant_id in self.subscriptions:
            del self.subscriptions[merchant_id]
            print(f"Merchant {merchant_id} unsubscribed from push notifications")
    
    async def send_order_notification(self, merchant_id: int, order_data: Dict[str, Any]):
        """Send push notification for new order"""
        if merchant_id not in self.subscriptions:
            print(f"No subscription found for merchant {merchant_id}")
            return
        
        subscription = self.subscriptions[merchant_id]
        
        # Create notification payload
        notification = {
            "title": "New Order Received!",
            "body": f"Order #{order_data.get('order_id', 'N/A')} from {order_data.get('customer_name', 'Customer')} - ₹{order_data.get('amount', 0)}",
            "icon": "/icons/icon-192x192.png",
            "badge": "/icons/badge-72x72.png",
            "data": {
                "order_id": order_data.get('order_id'),
                "merchant_id": merchant_id,
                "amount": order_data.get('amount'),
                "customer_name": order_data.get('customer_name'),
                "timestamp": order_data.get('timestamp'),
                "url": "/orders"
            },
            "actions": [
                {
                    "action": "view",
                    "title": "View Order",
                    "icon": "/icons/view-icon.png"
                },
                {
                    "action": "dismiss",
                    "title": "Dismiss",
                    "icon": "/icons/dismiss-icon.png"
                }
            ],
            "requireInteraction": True,
            "vibrate": [200, 100, 200],
            "tag": f"order-{order_data.get('order_id', 'unknown')}"
        }
        
        try:
            # In a real implementation, you'd use a service like Firebase Cloud Messaging
            # For now, we'll just log the notification
            print(f"Sending push notification to merchant {merchant_id}:")
            print(json.dumps(notification, indent=2))
            
            # Simulate sending notification
            await asyncio.sleep(0.1)
            print(f"Push notification sent successfully to merchant {merchant_id}")
            
        except Exception as e:
            print(f"Failed to send push notification to merchant {merchant_id}: {e}")
    
    async def send_order_update_notification(self, merchant_id: int, order_data: Dict[str, Any]):
        """Send push notification for order update"""
        if merchant_id not in self.subscriptions:
            return
        
        subscription = self.subscriptions[merchant_id]
        
        notification = {
            "title": "Order Updated",
            "body": f"Order #{order_data.get('order_id', 'N/A')} status updated to {order_data.get('status', 'unknown')}",
            "icon": "/icons/icon-192x192.png",
            "data": {
                "order_id": order_data.get('order_id'),
                "merchant_id": merchant_id,
                "status": order_data.get('status'),
                "timestamp": order_data.get('timestamp'),
                "url": "/orders"
            },
            "tag": f"order-update-{order_data.get('order_id', 'unknown')}"
        }
        
        try:
            print(f"Sending order update notification to merchant {merchant_id}:")
            print(json.dumps(notification, indent=2))
            await asyncio.sleep(0.1)
            print(f"Order update notification sent successfully to merchant {merchant_id}")
        except Exception as e:
            print(f"Failed to send order update notification to merchant {merchant_id}: {e}")
    
    def get_subscription_count(self) -> int:
        """Get total number of active subscriptions"""
        return len(self.subscriptions)
    
    def get_merchant_subscription(self, merchant_id: int) -> Optional[Dict[str, Any]]:
        """Get subscription data for a specific merchant"""
        return self.subscriptions.get(merchant_id)

# Global instance
push_service = PushNotificationService()
