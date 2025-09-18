"""
Main FastAPI application for GraminStore Backend API
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# Import configuration and database
from app.config import settings
from app.models.database import engine, create_tables

# Import API router
from app.api.v1.router import api_router

# Import admin setup (temporarily disabled due to sqladmin issues)
from app.admin import setup_admin, create_admin_user
from app.utils.admin_auth import AdminAuth

# Import models for SQLAdmin
from app.models import merchant, user, guest_user

# Create FastAPI app
app = FastAPI(
    title="GraminStore Backend API",
    description="Backend API for GraminStore - A dual-role PWA for merchants and consumers",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add session middleware for admin authentication
app.add_middleware(
    SessionMiddleware, 
    secret_key=settings.secret_key,
    max_age=3600,  # 1 hour session timeout
    session_cookie="admin_session",
    same_site="lax"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)

# Setup admin dashboard with authentication (temporarily disabled)
authentication_backend = AdminAuth(secret_key=settings.secret_key)
admin = setup_admin(app, engine, authentication_backend)


@app.on_event("startup")
async def startup_event():
    """Initialize database and create tables on startup"""
    print("Starting GraminStore Backend API...")
    
    # Create database tables
    create_tables()
    print("Database tables created/verified")
    
    # Load existing transaction tables into metadata
    from app.models.transaction import load_existing_transaction_tables
    load_existing_transaction_tables()
    
    # Create admin user (temporarily disabled)
    create_admin_user(engine)
    print("Admin user verified/created")
    
    print("GraminStore Backend API started successfully!")


@app.get("/", response_class=HTMLResponse)
async def root():
    """Root endpoint with API information"""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>GraminStore Backend API</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 50px auto; 
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #2c3e50; }
            h2 { color: #34495e; margin-top: 30px; }
            .endpoint { 
                background: #ecf0f1; 
                padding: 10px; 
                margin: 10px 0; 
                border-radius: 5px;
                border-left: 4px solid #3498db;
            }
            .method { 
                font-weight: bold; 
                color: #e74c3c;
                display: inline-block;
                width: 60px;
            }
            .admin-link {
                display: inline-block;
                padding: 10px 20px;
                background: #3498db;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 10px 5px;
            }
            .admin-link:hover {
                background: #2980b9;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🏪 GraminStore Backend API</h1>
            <p>Welcome to the GraminStore Backend API - A comprehensive solution for merchants and consumers.</p>
            
            <h2>📚 API Documentation</h2>
            <a href="/docs" class="admin-link">Swagger UI</a>
            <a href="/redoc" class="admin-link">ReDoc</a>
            <a href="/admin" class="admin-link">Admin Dashboard (Login Required)</a>
            
            <h2>🔑 Authentication Endpoints</h2>
            <div class="endpoint">
                <span class="method">POST</span> /api/v1/auth/register/merchant - Register merchant
            </div>
            <div class="endpoint">
                <span class="method">POST</span> /api/v1/auth/register/user - Register user
            </div>
            <div class="endpoint">
                <span class="method">POST</span> /api/v1/auth/login/merchant - Merchant login
            </div>
            <div class="endpoint">
                <span class="method">POST</span> /api/v1/auth/login/user - User login
            </div>
            
            <h2>💰 Transaction Endpoints</h2>
            <div class="endpoint">
                <span class="method">POST</span> /api/v1/transactions/create - Create transaction
            </div>
            <div class="endpoint">
                <span class="method">GET</span> /api/v1/transactions/history - Get transaction history
            </div>
            <div class="endpoint">
                <span class="method">GET</span> /api/v1/transactions/analytics - Get analytics
            </div>
            
            <h2>📊 Dashboard Endpoints</h2>
            <div class="endpoint">
                <span class="method">GET</span> /api/v1/dashboard/merchant - Merchant dashboard
            </div>
            <div class="endpoint">
                <span class="method">GET</span> /api/v1/dashboard/user - User dashboard
            </div>
            
            <h2>🔌 WebSocket</h2>
            <div class="endpoint">
                <span class="method">WS</span> /api/v1/ws/transaction-history/{token} - Real-time updates
            </div>
            
            <h2>ℹ️ System Info</h2>
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Database:</strong> PostgreSQL</p>
            <p><strong>Framework:</strong> FastAPI</p>
            
            <h2>🔐 Admin Access</h2>
            <p><strong>Admin Dashboard:</strong> <a href="/admin">/admin</a></p>
            <p><strong>Username:</strong> admin</p>
            <p><strong>Password:</strong> admin123</p>
            <p><em>Note: Admin dashboard requires authentication</em></p>
            
            <h2>🛠️ Development</h2>
            <p>To get started with development:</p>
            <ol>
                <li>Start PostgreSQL: <code>docker-compose up postgres</code></li>
                <li>Install dependencies: <code>pip install -r requirements.txt</code></li>
                <li>Run the server: <code>uvicorn app.main:app --reload --port 8001</code></li>
                <li>Insert fake data: <code>python setup_dev_data.py</code></li>
            </ol>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content, status_code=200)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "GraminStore Backend API is running",
        "version": "1.0.0"
    }


@app.get("/favicon.ico")
async def favicon():
    """Handle favicon requests"""
    return Response(status_code=204)


# @app.exception_handler(404)
# async def not_found_handler(request, exc):
#     """Handle 404 errors"""
#     return JSONResponse(
#         status_code=404,
#         content={"detail": "Endpoint not found. Visit /docs for API documentation."}
#     )


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
