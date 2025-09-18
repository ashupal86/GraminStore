"""
Admin authentication for SQLAdmin dashboard
"""
from typing import Optional
from starlette.requests import Request
from starlette.responses import Response, RedirectResponse
from sqladmin.authentication import AuthenticationBackend
from app.config import settings
from app.utils.auth import verify_password, get_password_hash


class AdminAuth(AuthenticationBackend):
    """Authentication backend for SQLAdmin"""
    
    async def login(self, request: Request) -> bool:
        """Handle admin login"""
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        
        # Check credentials against configured admin user
        if (username == settings.admin_username and password == settings.admin_password):
            # Store admin session
            request.session.update({"admin_authenticated": True, "admin_user": username})
            return True
        
        return False
    
    async def logout(self, request: Request) -> bool:
        """Handle admin logout"""
        request.session.clear()
        return True
    
    async def authenticate(self, request: Request) -> bool:
        """Check if user is authenticated"""
        return request.session.get("admin_authenticated", False)
