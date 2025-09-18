"""
Transaction model with dynamic table creation per merchant
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Enum, Text, Table, MetaData, create_engine, Boolean
from sqlalchemy.orm import Session
from app.models.database import engine, metadata
import enum


class TransactionType(str, enum.Enum):
    """Transaction types enum"""
    PAYED = "PAYED"
    PAY_LATER = "PAY_LATER"


class PaymentMethod(str, enum.Enum):
    """Payment method enum"""
    ONLINE = "online"
    CASH = "cash"


def create_merchant_transaction_table(merchant_id: int):
    """
    Creates a dynamic transaction table for a specific merchant
    Returns the table object for further operations
    """
    table_name = f"transaction_{merchant_id}"
    
    # Check if table already exists
    if table_name in metadata.tables:
        return metadata.tables[table_name]
    
    # Create new table
    transaction_table = Table(
        table_name,
        metadata,
        Column('transaction_id', Integer, primary_key=True, autoincrement=True),
        Column('user_id', Integer, nullable=True),  # Used by both user and guest
        Column('timestamp', DateTime, default=datetime.utcnow, nullable=False),
        Column('amount', Numeric(10, 2), nullable=False),
        Column('type', Enum(TransactionType), nullable=False),
        Column('description', Text, nullable=True),
        Column('payment_method', String(50), nullable=True),
        Column('guest_user_id', Integer, nullable=True),
        extend_existing=True
    )
    
    # Create the table in database
    transaction_table.create(engine, checkfirst=True)
    
    return transaction_table


def load_existing_transaction_tables():
    """
    Load all existing transaction tables into metadata
    This should be called at application startup
    """
    from sqlalchemy import text
    
    with Session(engine) as session:
        # Get all table names that start with 'transaction_'
        result = session.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename LIKE 'transaction_%'
        """))
        
        table_names = [row[0] for row in result.fetchall()]
        
        for table_name in table_names:
            if table_name not in metadata.tables:
                # Extract merchant_id from table name
                try:
                    merchant_id = int(table_name.replace('transaction_', ''))
                    # Create table object and add to metadata
                    create_merchant_transaction_table(merchant_id)
                    print(f"✅ Loaded transaction table: {table_name}")
                except ValueError:
                    print(f"❌ Invalid transaction table name: {table_name}")
        
        print(f"📊 Loaded {len([t for t in metadata.tables.keys() if t.startswith('transaction_')])} transaction tables")


def get_merchant_transaction_table(merchant_id: int):
    """Get existing transaction table for a merchant"""
    table_name = f"transaction_{merchant_id}"
    return metadata.tables.get(table_name)


def get_or_create_guest_user(merchant_id: int):
    """Get existing guest user for merchant or create one if doesn't exist"""
    from app.models.guest_user import GuestUser
    
    with Session(engine) as session:
        # Try to get existing guest user for this merchant
        guest_user = session.query(GuestUser).filter(
            GuestUser.merchant_id == merchant_id
        ).first()
        
        if guest_user:
            return guest_user.id
        
        # Create new guest user if none exists
        guest_user = GuestUser(merchant_id=merchant_id, transaction_id=0)  # Use 0 as placeholder
        session.add(guest_user)
        session.commit()
        session.refresh(guest_user)
        return guest_user.id


def _map_transaction_type_to_db(transaction_type: TransactionType) -> str:
    """Map frontend transaction type values to database values"""
    # The enum values are now the database values, so just return them
    return transaction_type.value

def _map_transaction_type_from_db(db_type: str) -> str:
    """Map database transaction type values to frontend values"""
    mapping = {
        "PAYED": "payed",
        "PAY_LATER": "pending"
    }
    return mapping.get(db_type, "payed")

def _map_frontend_to_enum(frontend_type: str) -> TransactionType:
    """Map frontend transaction type values to enum values"""
    mapping = {
        "payed": TransactionType.PAYED,
        "pending": TransactionType.PAY_LATER
    }
    return mapping.get(frontend_type, TransactionType.PAYED)


def insert_transaction(
    merchant_id: int,
    user_id: int = None,
    amount: float = 0.0,
    transaction_type: TransactionType = TransactionType.PAYED,
    description: str = None,
    payment_method: PaymentMethod = None,
    timestamp: datetime = None,
    is_guest_transaction: bool = False
):
    """Insert a transaction into merchant-specific table"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        table = create_merchant_transaction_table(merchant_id)
    
    # Use provided timestamp or current time
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    # For guest transactions, get or create guest user
    if is_guest_transaction:
        user_id = get_or_create_guest_user(merchant_id)
    
    with Session(engine) as session:
        # Insert transaction
        insert_stmt = table.insert().values(
            user_id=user_id,
            timestamp=timestamp,
            amount=amount,
            type=_map_transaction_type_to_db(transaction_type),
            description=description,
            payment_method=payment_method,
            guest_user_id=user_id if is_guest_transaction else None
        )
        result = session.execute(insert_stmt)
        transaction_id = result.inserted_primary_key[0]
        session.commit()
        
        return transaction_id, user_id


def get_merchant_transactions(merchant_id: int, limit: int = 100, offset: int = 0):
    """Get transactions for a specific merchant"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        return []
    
    with Session(engine) as session:
        select_stmt = table.select().order_by(table.c.timestamp.desc()).limit(limit).offset(offset)
        result = session.execute(select_stmt)
        return result.fetchall()

def get_merchant_transactions_by_period(merchant_id: int, days: int = 30, limit: int = 100, offset: int = 0):
    """Get transactions for a specific merchant within a time period"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        return []
    
    from datetime import datetime, timedelta
    cutoff_date = datetime.now() - timedelta(days=days)
    
    with Session(engine) as session:
        select_stmt = table.select().where(
            table.c.timestamp >= cutoff_date
        ).order_by(table.c.timestamp.desc()).limit(limit).offset(offset)
        result = session.execute(select_stmt)
        return result.fetchall()


def get_merchant_transaction_analytics(merchant_id: int, days: int = 30):
    """Get transaction analytics for a merchant"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        return {
            "total_sales": 0,
            "total_transactions": 0,
            "total_pending": 0,
            "avg_transaction": 0
        }
    
    from sqlalchemy import func, select
    from datetime import datetime, timedelta
    
    # Calculate date filter
    date_filter = datetime.utcnow() - timedelta(days=days)
    
    with Session(engine) as session:
        # Calculate analytics with proper select statements
        total_sales = session.execute(
            select(func.sum(table.c.amount)).where(
                (table.c.type == TransactionType.PAYED) &
                (table.c.timestamp >= date_filter)
            )
        ).scalar() or 0
        
        total_transactions = session.execute(
            select(func.count(table.c.transaction_id)).where(
                table.c.timestamp >= date_filter
            )
        ).scalar() or 0
        
        total_pending = session.execute(
            select(func.sum(table.c.amount)).where(
                (table.c.type == TransactionType.PAY_LATER) &
                (table.c.timestamp >= date_filter)
            )
        ).scalar() or 0
        
        avg_transaction = session.execute(
            select(func.avg(table.c.amount)).where(
                table.c.timestamp >= date_filter
            )
        ).scalar() or 0
        
        return {
            "total_sales": float(total_sales),
            "total_transactions": total_transactions,
            "total_pending": float(total_pending),
            "avg_transaction": float(avg_transaction)
        }


def get_guest_user_transaction_analytics(merchant_id: int, user_id: int):
    """Get transaction analytics for a specific guest user"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        return {
            "total_transactions": 0,
            "total_amount_paid": 0,
            "total_amount_pending": 0,
            "last_transaction_date": None,
            "recent_transactions": []
        }
    
    from sqlalchemy import func, select
    
    with Session(engine) as session:
        # Filter for this guest user - now using user_id and guest_user_id
        guest_filter = (table.c.user_id == user_id) & (table.c.guest_user_id.isnot(None))
        
        # Total transactions count
        total_transactions = session.execute(
            select(func.count(table.c.transaction_id)).where(guest_filter)
        ).scalar() or 0
        
        # Total paid amount (PAYED transactions)
        total_amount_paid = session.execute(
            select(func.sum(table.c.amount)).where(
                guest_filter & (table.c.type == TransactionType.PAYED)
            )
        ).scalar() or 0
        
        # Total pending amount (PAY_LATER transactions)
        total_amount_pending = session.execute(
            select(func.sum(table.c.amount)).where(
                guest_filter & (table.c.type == TransactionType.PAY_LATER)
            )
        ).scalar() or 0
        
        # Last transaction date
        last_transaction_date = session.execute(
            select(func.max(table.c.timestamp)).where(guest_filter)
        ).scalar()
        
        # Recent transactions (last 3)
        recent_transactions_query = table.select().where(guest_filter).order_by(
            table.c.timestamp.desc()
        ).limit(3)
        recent_transactions_result = session.execute(recent_transactions_query).fetchall()
        
        recent_transactions = []
        for txn in recent_transactions_result:
            recent_transactions.append({
                "transaction_id": txn[0],
                "user_id": txn[1],
                "timestamp": txn[2].isoformat() if txn[2] else None,
                "amount": float(txn[3]),
                "type": txn[4],
                "description": txn[5],
                "payment_method": txn[6],
                "guest_user": txn[7]
            })
        
        return {
            "total_transactions": total_transactions,
            "total_amount_paid": float(total_amount_paid),
            "total_amount_pending": float(total_amount_pending),
            "last_transaction_date": last_transaction_date,
            "recent_transactions": recent_transactions
        }
