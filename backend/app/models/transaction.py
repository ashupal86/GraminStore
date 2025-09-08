"""
Transaction model with dynamic table creation per merchant
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Enum, Text, Table, MetaData, create_engine
from sqlalchemy.orm import Session
from app.models.database import engine, metadata
import enum


class TransactionType(str, enum.Enum):
    """Transaction types enum"""
    PAYED = "payed"
    PAY_LATER = "pay_later"


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
        Column('user_id', Integer, nullable=True),  # Can be null for guest users
        Column('guest_user_id', Integer, nullable=True),  # For guest users
        Column('timestamp', DateTime, default=datetime.utcnow, nullable=False),
        Column('amount', Numeric(10, 2), nullable=False),
        Column('type', Enum(TransactionType), nullable=False),
        Column('description', Text, nullable=True),
        Column('payment_method', String(50), nullable=True),
        Column('reference_number', String(100), nullable=True),
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


def create_guest_user_for_transaction(
    merchant_id: int,
    transaction_id: int
):
    """Create a simplified guest user for a specific transaction"""
    from app.models.guest_user import GuestUser
    
    with Session(engine) as session:
        guest_user = GuestUser(
            merchant_id=merchant_id,
            transaction_id=transaction_id
        )
        
        session.add(guest_user)
        session.commit()
        session.refresh(guest_user)
        return guest_user.id


def insert_transaction(
    merchant_id: int,
    user_id: int = None,
    guest_user_id: int = None,
    amount: float = 0.0,
    transaction_type: TransactionType = TransactionType.PAYED,
    description: str = None,
    payment_method: str = None,
    reference_number: str = None,
    timestamp: datetime = None,
    is_guest_transaction: bool = False
):
    """Insert a transaction into merchant-specific table and create guest user if needed"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        table = create_merchant_transaction_table(merchant_id)
    
    # Use provided timestamp or current time
    if timestamp is None:
        timestamp = datetime.utcnow()
    
    with Session(engine) as session:
        # Insert transaction first to get transaction_id
        insert_stmt = table.insert().values(
            user_id=user_id,
            guest_user_id=None,  # Will be updated after guest user creation
            timestamp=timestamp,
            amount=amount,
            type=transaction_type,
            description=description,
            payment_method=payment_method,
            reference_number=reference_number
        )
        result = session.execute(insert_stmt)
        transaction_id = result.inserted_primary_key[0]
        session.commit()
        
        # If this is a guest transaction, create new guest user
        if is_guest_transaction and user_id is None:
            new_guest_user_id = create_guest_user_for_transaction(
                merchant_id=merchant_id,
                transaction_id=transaction_id
            )
            
            # Update transaction with the new guest_user_id
            update_stmt = table.update().where(
                table.c.transaction_id == transaction_id
            ).values(guest_user_id=new_guest_user_id)
            
            session.execute(update_stmt)
            session.commit()
            
            return transaction_id, new_guest_user_id
        
        return transaction_id, guest_user_id


def get_merchant_transactions(merchant_id: int, limit: int = 100, offset: int = 0):
    """Get transactions for a specific merchant"""
    table = get_merchant_transaction_table(merchant_id)
    if table is None:
        return []
    
    with Session(engine) as session:
        select_stmt = table.select().order_by(table.c.timestamp.desc()).limit(limit).offset(offset)
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


def get_guest_user_transaction_analytics(merchant_id: int, guest_user_id: int):
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
        # Filter for this guest user
        guest_filter = table.c.guest_user_id == guest_user_id
        
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
                "timestamp": txn[3].isoformat() if txn[3] else None,
                "amount": float(txn[4]),
                "type": txn[5],
                "description": txn[6],
                "reference_number": txn[8]
            })
        
        return {
            "total_transactions": total_transactions,
            "total_amount_paid": float(total_amount_paid),
            "total_amount_pending": float(total_amount_pending),
            "last_transaction_date": last_transaction_date,
            "recent_transactions": recent_transactions
        }
