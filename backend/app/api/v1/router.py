"""
Main API v1 router that includes all route modules
"""
from fastapi import APIRouter
from app.api.v1 import auth, transactions, dashboard, websocket, inventory, marketplace, orders, admin

# Create main v1 router
api_router = APIRouter(prefix="/api/v1")

# Include all route modules
api_router.include_router(auth.router)
api_router.include_router(transactions.router)
api_router.include_router(dashboard.router)
api_router.include_router(websocket.router)
api_router.include_router(orders.router)
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(marketplace.router, prefix="/marketplace", tags=["marketplace"])
api_router.include_router(admin.router)

# Health check endpoint
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "GraminStore API is running",
        "version": "1.0.0"
    }
