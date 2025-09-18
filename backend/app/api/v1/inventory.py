from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import csv
import io

from app.models.database import get_db
from app.models.inventory import InventoryItem, PurchaseListItem, InventoryTransaction
from app.models.merchant import Merchant
from app.schemas.inventory import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    QuantityUpdateRequest, InventoryTransactionResponse, PurchaseListResponse,
    InventoryStatsResponse, PurchaseListItemResponse, PurchaseListCreateRequest
)
from app.utils.dependencies import get_current_merchant

router = APIRouter()


@router.get("/items", response_model=List[InventoryItemResponse])
async def get_inventory_items(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category: Optional[str] = None,
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get inventory items for the current merchant"""
    query = db.query(InventoryItem).filter(InventoryItem.merchant_id == current_merchant.id)
    
    if search:
        like = f"%{search}%"
        query = query.filter(
            (InventoryItem.name.ilike(like)) | (InventoryItem.sku.ilike(like))
        )
    
    if category:
        query = query.filter(InventoryItem.category == category)
    
    if low_stock_only:
        query = query.filter(InventoryItem.current_quantity <= InventoryItem.min_quantity)
    
    items = query.offset(skip).limit(limit).all()
    return items


@router.post("/items", response_model=InventoryItemResponse)
async def create_inventory_item(
    item: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Create a new inventory item"""
    # Check if SKU already exists
    if item.sku:
        existing_item = db.query(InventoryItem).filter(
            InventoryItem.sku == item.sku,
            InventoryItem.merchant_id == current_merchant.id
        ).first()
        if existing_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SKU already exists"
            )
    
    db_item = InventoryItem(
        merchant_id=current_merchant.id,
        **item.dict()
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Create initial transaction record
    if db_item.current_quantity > 0:
        transaction = InventoryTransaction(
            merchant_id=current_merchant.id,
            inventory_item_id=db_item.id,
            transaction_type="in",
            quantity_change=db_item.current_quantity,
            previous_quantity=0,
            new_quantity=db_item.current_quantity,
            reason="Initial stock"
        )
        db.add(transaction)
        db.commit()
    
    return db_item


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get a specific inventory item"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    return item


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: int,
    item_update: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Update an inventory item"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Check SKU uniqueness if updating SKU
    if item_update.sku and item_update.sku != item.sku:
        existing_item = db.query(InventoryItem).filter(
            InventoryItem.sku == item_update.sku,
            InventoryItem.merchant_id == current_merchant.id
        ).first()
        if existing_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SKU already exists"
            )
    
    update_data = item_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
async def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Delete an inventory item (soft delete by setting is_active=False)"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    item.is_active = False
    db.commit()
    return {"message": "Inventory item deleted successfully"}


@router.post("/items/{item_id}/quantity", response_model=InventoryItemResponse)
async def update_quantity(
    item_id: int,
    quantity_update: QuantityUpdateRequest,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Update item quantity and create transaction record"""
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    previous_quantity = item.current_quantity
    new_quantity = previous_quantity + quantity_update.quantity_change
    
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be negative"
        )
    
    # Determine transaction type
    if quantity_update.quantity_change > 0:
        transaction_type = "in"
    elif quantity_update.quantity_change < 0:
        transaction_type = "out"
    else:
        transaction_type = "adjustment"
    
    # Update quantity
    item.current_quantity = new_quantity
    
    # Create transaction record
    transaction = InventoryTransaction(
        merchant_id=current_merchant.id,
        inventory_item_id=item.id,
        transaction_type=transaction_type,
        quantity_change=quantity_update.quantity_change,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        reason=quantity_update.reason
    )
    db.add(transaction)
    db.commit()
    db.refresh(item)
    
    return item


@router.get("/items/{item_id}/transactions", response_model=List[InventoryTransactionResponse])
async def get_item_transactions(
    item_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get transaction history for an inventory item"""
    # Verify item belongs to merchant
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    transactions = db.query(InventoryTransaction).filter(
        InventoryTransaction.inventory_item_id == item_id
    ).order_by(InventoryTransaction.created_at.desc()).offset(skip).limit(limit).all()
    
    return transactions


@router.get("/stats", response_model=InventoryStatsResponse)
async def get_inventory_stats(
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get inventory statistics for the merchant"""
    items = db.query(InventoryItem).filter(
        InventoryItem.merchant_id == current_merchant.id,
        InventoryItem.is_active == True
    ).all()
    
    total_items = len(items)
    low_stock_items = sum(1 for item in items if item.is_low_stock)
    out_of_stock_items = sum(1 for item in items if item.current_quantity == 0)
    total_value = sum(item.current_quantity * (item.unit_price or 0) for item in items)
    categories = list(set(item.category for item in items if item.category))
    
    return InventoryStatsResponse(
        total_items=total_items,
        low_stock_items=low_stock_items,
        out_of_stock_items=out_of_stock_items,
        total_value=total_value,
        categories=categories
    )


@router.get("/purchase-list", response_model=PurchaseListResponse)
async def get_purchase_list(
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get purchase list for low stock items"""
    # Get all low stock items
    low_stock_items = db.query(InventoryItem).filter(
        InventoryItem.merchant_id == current_merchant.id,
        InventoryItem.is_active == True,
        InventoryItem.current_quantity <= InventoryItem.min_quantity
    ).all()
    
    # Create or update purchase list items
    purchase_items = []
    for item in low_stock_items:
        quantity_needed = item.min_quantity - item.current_quantity
        
        # Check if already in purchase list
        existing_purchase_item = db.query(PurchaseListItem).filter(
            PurchaseListItem.merchant_id == current_merchant.id,
            PurchaseListItem.inventory_item_id == item.id,
            PurchaseListItem.is_purchased == False
        ).first()
        
        if existing_purchase_item:
            existing_purchase_item.quantity_needed = quantity_needed
            purchase_items.append(existing_purchase_item)
        else:
            purchase_item = PurchaseListItem(
                merchant_id=current_merchant.id,
                inventory_item_id=item.id,
                quantity_needed=quantity_needed
            )
            db.add(purchase_item)
            purchase_items.append(purchase_item)
    
    db.commit()
    
    # Refresh to get updated data
    for item in purchase_items:
        db.refresh(item)
    
    total_quantity = sum(item.quantity_needed for item in purchase_items)
    
    return PurchaseListResponse(
        merchant_name=current_merchant.business_name or current_merchant.name,
        generated_date=datetime.now(),
        total_items=len(purchase_items),
        total_quantity=total_quantity,
        items=purchase_items
    )


@router.post("/purchase-list", response_model=PurchaseListItemResponse)
async def add_to_purchase_list(
    request: PurchaseListCreateRequest,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Add an item to the purchase list"""
    # Verify item belongs to merchant
    item = db.query(InventoryItem).filter(
        InventoryItem.id == request.inventory_item_id,
        InventoryItem.merchant_id == current_merchant.id
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found"
        )
    
    # Check if already in purchase list
    existing_purchase_item = db.query(PurchaseListItem).filter(
        PurchaseListItem.merchant_id == current_merchant.id,
        PurchaseListItem.inventory_item_id == request.inventory_item_id,
        PurchaseListItem.is_purchased == False
    ).first()
    
    if existing_purchase_item:
        existing_purchase_item.quantity_needed = request.quantity_needed
        db.commit()
        db.refresh(existing_purchase_item)
        return existing_purchase_item
    else:
        purchase_item = PurchaseListItem(
            merchant_id=current_merchant.id,
            inventory_item_id=request.inventory_item_id,
            quantity_needed=request.quantity_needed
        )
        db.add(purchase_item)
        db.commit()
        db.refresh(purchase_item)
        return purchase_item


@router.get("/purchase-list/download")
async def download_purchase_list(
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Download purchase list as CSV"""
    purchase_list = await get_purchase_list(db, current_merchant)
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([purchase_list.merchant_name])
    writer.writerow([f"Generated on: {purchase_list.generated_date.strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([f"Total Items: {purchase_list.total_items}"])
    writer.writerow([f"Total Quantity: {purchase_list.total_quantity}"])
    writer.writerow([])  # Empty row
    writer.writerow(["Item Name", "Category", "Quantity Needed", "Unit", "Current Stock", "Min Required"])
    
    # Items
    for item in purchase_list.items:
        inventory_item = item.inventory_item
        writer.writerow([
            inventory_item.name,
            inventory_item.category or "N/A",
            item.quantity_needed,
            inventory_item.unit,
            inventory_item.current_quantity,
            inventory_item.min_quantity
        ])
    
    output.seek(0)
    csv_content = output.getvalue()
    output.close()
    
    from fastapi.responses import Response
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=purchase_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@router.post("/purchase-list/{item_id}/mark-purchased")
async def mark_item_purchased(
    item_id: int,
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Mark a purchase list item as purchased"""
    purchase_item = db.query(PurchaseListItem).filter(
        PurchaseListItem.id == item_id,
        PurchaseListItem.merchant_id == current_merchant.id
    ).first()
    
    if not purchase_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase list item not found"
        )
    
    purchase_item.is_purchased = True
    db.commit()
    
    return {"message": "Item marked as purchased"}


@router.get("/categories")
async def get_categories(
    db: Session = Depends(get_db),
    current_merchant: Merchant = Depends(get_current_merchant)
):
    """Get all categories used by the merchant"""
    categories = db.query(InventoryItem.category).filter(
        InventoryItem.merchant_id == current_merchant.id,
        InventoryItem.is_active == True,
        InventoryItem.category.isnot(None)
    ).distinct().all()
    
    return [cat[0] for cat in categories]
