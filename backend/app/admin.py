"""
SQLAdmin configuration for admin dashboard
"""
from sqladmin import Admin, ModelView
from sqlalchemy import create_engine, text
from app.models.merchant import Merchant
from app.models.user import User
from app.models.guest_user import GuestUser
from app.config import settings


class MerchantAdmin(ModelView, model=Merchant):
    """Admin view for Merchant model"""
    column_list = [
        Merchant.id, Merchant.name, Merchant.email, Merchant.phone,
        Merchant.aadhar_number, Merchant.business_name, Merchant.city, 
        Merchant.state, Merchant.business_type, Merchant.created_at
    ]
    column_searchable_list = [
        Merchant.name, Merchant.email, Merchant.phone, 
        Merchant.aadhar_number, Merchant.business_name, Merchant.city, Merchant.state
    ]
    column_sortable_list = [Merchant.id, Merchant.name, Merchant.created_at]
    column_details_exclude_list = [Merchant.password_hash]
    form_excluded_columns = [Merchant.password_hash, Merchant.created_at, Merchant.updated_at]
    
    name = "Merchant"
    name_plural = "Merchants"
    icon = "fa-solid fa-store"


class UserAdmin(ModelView, model=User):
    """Admin view for User model"""
    column_list = [User.id, User.name, User.email, User.phone, User.created_at]
    column_searchable_list = [User.name, User.email, User.phone]
    column_sortable_list = [User.id, User.name, User.created_at]
    column_details_exclude_list = [User.password_hash]
    form_excluded_columns = [User.password_hash, User.created_at, User.updated_at]
    
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-users"


class GuestUserAdmin(ModelView, model=GuestUser):
    """Admin view for simplified GuestUser model"""
    column_list = [
        GuestUser.id, GuestUser.merchant_id, GuestUser.timestamp
    ]
    column_searchable_list = [GuestUser.id, GuestUser.merchant_id]
    column_sortable_list = [GuestUser.id, GuestUser.timestamp, GuestUser.merchant_id]
    form_excluded_columns = [GuestUser.timestamp]
    
    name = "Guest User"
    name_plural = "Guest Users"
    icon = "fa-solid fa-user-clock"


def setup_admin(app, engine, authentication_backend=None):
    """Set up SQLAdmin with the FastAPI app"""
    admin = Admin(
        app=app,
        engine=engine,
        title="GraminStore Admin Dashboard",
        logo_url="/static/logo.png",  # You can add a logo later
        authentication_backend=authentication_backend
    )
    
    # Add model views
    admin.add_view(MerchantAdmin)
    admin.add_view(UserAdmin)
    admin.add_view(GuestUserAdmin)
    
    return admin


def create_admin_user(engine):
    """Create default admin user if it doesn't exist"""
    from sqlalchemy.orm import sessionmaker
    from app.utils.auth import get_password_hash
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    try:
        # Check if admin merchant exists
        admin_merchant = session.query(Merchant).filter(
            Merchant.email == settings.admin_username + "@admin.com"
        ).first()
        
        if not admin_merchant:
            # Create admin merchant
            admin_merchant = Merchant(
                name="Admin User",
                email=settings.admin_username + "@admin.com",
                phone="0000000000",
                password_hash=get_password_hash(settings.admin_password),
                aadhar_number="000000000000",
                business_name="Admin Store",
                city="Admin City",
                state="Admin State",
                zip_code="000000",
                country="India",
                business_type="Administration"
            )
            session.add(admin_merchant)
            session.commit()
            print("Admin user created successfully")
    
    except Exception as e:
        print(f"Error creating admin user: {e}")
        session.rollback()
    finally:
        session.close()


class TransactionTableView:
    """Custom view for dynamic transaction tables"""
    
    def __init__(self, admin, engine):
        self.admin = admin
        self.engine = engine
    
    def get_transaction_tables(self):
        """Get list of all transaction tables"""
        with self.engine.connect() as connection:
            result = connection.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_name LIKE 'transaction_%' AND table_schema = 'public'"
            ))
            return [row[0] for row in result]
    
    def create_transaction_view(self, table_name):
        """Create a dynamic view for transaction table"""
        # This would be implemented if needed for viewing individual transaction tables
        # For now, merchants can view their transactions through the API
        pass
