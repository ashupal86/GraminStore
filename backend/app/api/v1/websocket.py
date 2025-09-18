"""
WebSocket routes for real-time transaction and order updates
"""
import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status, HTTPException
from sqlalchemy.orm import Session
from app.models.database import get_db
from app.models.transaction import get_merchant_transactions, get_merchant_transactions_by_period
from app.utils.auth import verify_token

router = APIRouter(prefix="/ws", tags=["WebSocket"])


class ConnectionManager:
    """WebSocket connection manager for handling multiple connections"""
    
    def __init__(self):
        # Dictionary to store connections by merchant_id
        self.merchant_connections: Dict[int, List[WebSocket]] = {}
        # Dictionary to store connections by user_id
        self.user_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int, user_type: str):
        """Connect a new WebSocket client"""
        await websocket.accept()
        
        if user_type == "merchant":
            if user_id not in self.merchant_connections:
                self.merchant_connections[user_id] = []
            self.merchant_connections[user_id].append(websocket)
        elif user_type == "user":
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: int, user_type: str):
        """Disconnect a WebSocket client"""
        if user_type == "merchant" and user_id in self.merchant_connections:
            if websocket in self.merchant_connections[user_id]:
                self.merchant_connections[user_id].remove(websocket)
                if not self.merchant_connections[user_id]:
                    del self.merchant_connections[user_id]
        
        elif user_type == "user" and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
    
    async def send_to_merchant(self, merchant_id: int, message: dict):
        """Send message to all connections of a specific merchant"""
        print(f"DEBUG: Attempting to send to merchant {merchant_id}, connections: {merchant_id in self.merchant_connections}")
        if merchant_id in self.merchant_connections:
            print(f"DEBUG: Found {len(self.merchant_connections[merchant_id])} connections for merchant {merchant_id}")
            disconnected = []
            for websocket in self.merchant_connections[merchant_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                    print(f"DEBUG: Message sent to merchant {merchant_id}")
                except Exception as e:
                    print(f"DEBUG: Error sending to merchant {merchant_id}: {e}")
                    disconnected.append(websocket)
            
            # Remove disconnected websockets
            for ws in disconnected:
                self.merchant_connections[merchant_id].remove(ws)
    
    async def send_to_user(self, user_id: int, message: dict):
        """Send message to all connections of a specific user"""
        if user_id in self.user_connections:
            disconnected = []
            for websocket in self.user_connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except:
                    disconnected.append(websocket)
            
            # Remove disconnected websockets
            for ws in disconnected:
                self.user_connections[user_id].remove(ws)


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/orders/{token}")
async def websocket_orders(
    websocket: WebSocket,
    token: str
):
    """WebSocket endpoint for real-time order and transaction updates"""
    # Verify token
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    user_id = int(payload.get("sub"))
    user_type = payload.get("user_type")
    
    if not user_id or not user_type:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await manager.connect(websocket, user_id, user_type)
    
    try:
        while True:
            # Wait for client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "get_orders":
                # Send order/transaction history
                if user_type == "merchant":
                    transactions = get_merchant_transactions_by_period(
                        merchant_id=user_id,
                        days=message.get("days", 30),
                        limit=message.get("limit", 50),
                        offset=message.get("offset", 0)
                    )
                    
                    transaction_list = []
                    for txn in transactions:
                        transaction_list.append({
                            "transaction_id": txn[0],
                            "user_id": txn[1],
                            "guest_user_id": txn[7],
                            "timestamp": txn[2].isoformat() if txn[2] else None,
                            "amount": float(txn[3]),
                            "type": txn[4],
                            "description": txn[5],
                            "payment_method": txn[6],
                            "is_guest_order": txn[7] is not None
                        })
                    
                    response = {
                        "type": "orders_update",
                        "data": transaction_list,
                        "merchant_id": user_id
                    }
                    
                    await websocket.send_text(json.dumps(response))
            
            elif message.get("type") == "ping":
                # Respond to ping
                await websocket.send_text(json.dumps({"type": "pong"}))
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, user_type)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id, user_type)


async def notify_order_update(merchant_id: int, order_data: dict):
    """Notify all connected clients about a new order/transaction"""
    message = {
        "type": "new_order",
        "data": order_data,
        "merchant_id": merchant_id,
        "timestamp": order_data.get("timestamp")
    }
    
    print(f"DEBUG: Sending WebSocket notification to merchant {merchant_id}: {message}")
    
    # Send to merchant
    await manager.send_to_merchant(merchant_id, message)
    
    # If order has a user_id, send to that user too
    if order_data.get("user_id"):
        await manager.send_to_user(order_data["user_id"], message)


async def notify_transaction_update(merchant_id: int, transaction_data: dict):
    """Notify all connected clients about a new transaction (legacy function)"""
    await notify_order_update(merchant_id, transaction_data)


# Export manager for use in other modules
__all__ = ["manager", "notify_transaction_update", "notify_order_update"]
