#!/usr/bin/env python3
"""
Test script to verify the complete order flow with websocket updates
"""
import asyncio
import websockets
import json
import requests
import time

# Configuration
API_BASE_URL = "http://localhost:8000"
WS_BASE_URL = "ws://localhost:8000"

async def test_order_flow():
    """Test the complete order flow from checkout to merchant notification"""
    
    print("🧪 Testing Order Flow with WebSocket Updates")
    print("=" * 50)
    
    # Step 1: Login as a user
    print("\n1. Logging in as user...")
    login_data = {
        "username": "testuser@example.com",
        "password": "testpassword"
    }
    
    try:
        response = requests.post(f"{API_BASE_URL}/api/v1/auth/login", json=login_data)
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            return
        
        user_data = response.json()
        user_token = user_data["access_token"]
        print(f"✅ User logged in successfully")
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Step 2: Login as a merchant
    print("\n2. Logging in as merchant...")
    merchant_login_data = {
        "username": "merchant@example.com", 
        "password": "merchantpassword"
    }
    
    try:
        response = requests.post(f"{API_BASE_URL}/api/v1/auth/login", json=merchant_login_data)
        if response.status_code != 200:
            print(f"❌ Merchant login failed: {response.text}")
            return
            
        merchant_data = response.json()
        merchant_token = merchant_data["access_token"]
        merchant_id = merchant_data["user"]["id"]
        print(f"✅ Merchant logged in successfully (ID: {merchant_id})")
        
    except Exception as e:
        print(f"❌ Merchant login error: {e}")
        return
    
    # Step 3: Setup WebSocket connection for merchant
    print("\n3. Setting up WebSocket connection for merchant...")
    
    async def merchant_websocket():
        uri = f"{WS_BASE_URL}/api/v1/ws/orders/{merchant_token}"
        try:
            async with websockets.connect(uri) as websocket:
                print("✅ Merchant WebSocket connected")
                
                # Listen for messages
                async for message in websocket:
                    data = json.loads(message)
                    print(f"📨 Merchant received: {data['type']}")
                    
                    if data['type'] == 'new_order':
                        print(f"🎉 NEW ORDER NOTIFICATION!")
                        print(f"   Order ID: {data['data']['order_id']}")
                        print(f"   Amount: ₹{data['data']['amount']}")
                        print(f"   Customer: {data['data']['customer_name']}")
                        print(f"   Items: {len(data['data']['items'])}")
                        return True
                        
        except Exception as e:
            print(f"❌ WebSocket error: {e}")
            return False
    
    # Step 4: Start WebSocket listener in background
    websocket_task = asyncio.create_task(merchant_websocket())
    
    # Give WebSocket time to connect
    await asyncio.sleep(2)
    
    # Step 5: Create a test order
    print("\n4. Creating test order...")
    
    checkout_data = {
        "cart_items": [
            {
                "id": 1,
                "name": "Test Product 1",
                "unit_price": 100.0,
                "quantity": 2,
                "unit": "kg",
                "merchant_id": merchant_id,
                "merchant_name": "Test Merchant",
                "category": "vegetables"
            },
            {
                "id": 2,
                "name": "Test Product 2", 
                "unit_price": 50.0,
                "quantity": 1,
                "unit": "piece",
                "merchant_id": merchant_id,
                "merchant_name": "Test Merchant",
                "category": "fruits"
            }
        ],
        "payment_method": "online",
        "customer_name": "Test Customer",
        "customer_phone": "1234567890",
        "is_guest_order": False
    }
    
    try:
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.post(
            f"{API_BASE_URL}/api/v1/orders/checkout",
            json=checkout_data,
            headers=headers
        )
        
        if response.status_code == 200:
            order_response = response.json()
            print(f"✅ Order created successfully!")
            print(f"   Order ID: {order_response['order_id']}")
            print(f"   Total Amount: ₹{order_response['total_amount']}")
            print(f"   Items Count: {order_response['items_count']}")
        else:
            print(f"❌ Order creation failed: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Order creation error: {e}")
        return
    
    # Step 6: Wait for WebSocket notification
    print("\n5. Waiting for WebSocket notification...")
    
    try:
        # Wait up to 10 seconds for the notification
        result = await asyncio.wait_for(websocket_task, timeout=10.0)
        if result:
            print("✅ WebSocket notification received successfully!")
        else:
            print("❌ WebSocket notification failed")
    except asyncio.TimeoutError:
        print("❌ WebSocket notification timeout")
    except Exception as e:
        print(f"❌ WebSocket notification error: {e}")
    
    # Step 7: Verify order in merchant's order list
    print("\n6. Verifying order in merchant's order list...")
    
    try:
        headers = {"Authorization": f"Bearer {merchant_token}"}
        response = requests.get(
            f"{API_BASE_URL}/api/v1/orders/merchant/{merchant_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            orders = response.json()
            print(f"✅ Found {len(orders)} orders for merchant")
            
            if orders:
                latest_order = orders[0]  # Most recent order
                print(f"   Latest Order Amount: ₹{latest_order['amount']}")
                print(f"   Latest Order Type: {latest_order['type']}")
                print(f"   Latest Order Description: {latest_order['description']}")
        else:
            print(f"❌ Failed to fetch merchant orders: {response.text}")
            
    except Exception as e:
        print(f"❌ Order verification error: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 Order Flow Test Complete!")

if __name__ == "__main__":
    asyncio.run(test_order_flow())
