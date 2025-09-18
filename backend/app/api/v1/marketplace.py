from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from sqlalchemy import func, and_, or_

from app.models.database import get_db
from app.models.inventory import InventoryItem
from app.models.merchant import Merchant
from app.schemas.inventory import InventoryItemResponse

router = APIRouter()


@router.get("/merchants", response_model=List[Dict[str, Any]])
async def get_merchants_with_inventory(
    db: Session = Depends(get_db)
):
    """Get all merchants with their inventory items grouped by categories"""
    # Get all merchants that have active inventory items
    merchants = db.query(Merchant).join(InventoryItem).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0
    ).distinct().all()
    
    result = []
    for merchant in merchants:
        # Get inventory items for this merchant
        items = db.query(InventoryItem).filter(
            InventoryItem.merchant_id == merchant.id,
            InventoryItem.is_active == True,
            InventoryItem.current_quantity > 0
        ).all()
        
        # Group items by category
        categories = {}
        for item in items:
            category = item.category or "Uncategorized"
            if category not in categories:
                categories[category] = []
            categories[category].append(item)
        
        merchant_data = {
            "id": merchant.id,
            "name": merchant.name,
            "business_name": merchant.business_name or merchant.name,
            "city": merchant.city,
            "state": merchant.state,
            "categories": {}
        }
        
        # Add items grouped by category
        for category, items_list in categories.items():
            merchant_data["categories"][category] = [
                {
                    "id": item.id,
                    "name": item.name,
                    "description": item.description,
                    "category": item.category,
                    "sku": item.sku,
                    "current_quantity": item.current_quantity,
                    "unit_price": item.unit_price,
                    "unit": item.unit,
                    "merchant_id": item.merchant_id
                }
                for item in items_list
            ]
        
        result.append(merchant_data)
    
    return result


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_items_across_merchants(
    query: str = Query(..., description="Search term for items"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, description="Maximum number of results"),
    skip: int = Query(0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """Search for items across all merchants"""
    # Build search query
    search_filter = and_(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0,
        or_(
            InventoryItem.name.ilike(f"%{query}%"),
            InventoryItem.description.ilike(f"%{query}%"),
            InventoryItem.sku.ilike(f"%{query}%")
        )
    )
    
    if category:
        search_filter = and_(search_filter, InventoryItem.category == category)
    
    # Get items with merchant information
    items = db.query(InventoryItem, Merchant).join(
        Merchant, InventoryItem.merchant_id == Merchant.id
    ).filter(search_filter).offset(skip).limit(limit).all()
    
    result = []
    for item, merchant in items:
        result.append({
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "category": item.category,
            "sku": item.sku,
            "current_quantity": item.current_quantity,
            "unit_price": item.unit_price,
            "unit": item.unit,
            "merchant": {
                "id": merchant.id,
                "name": merchant.name,
                "business_name": merchant.business_name or merchant.name,
                "city": merchant.city,
                "state": merchant.state
            }
        })
    
    return result


@router.get("/categories", response_model=List[str])
async def get_all_categories(
    db: Session = Depends(get_db)
):
    """Get all unique categories from all merchants' inventory"""
    categories = db.query(InventoryItem.category).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0,
        InventoryItem.category.isnot(None)
    ).distinct().all()
    
    return [cat[0] for cat in categories if cat[0]]


@router.get("/merchant/{merchant_id}/items", response_model=List[InventoryItemResponse])
async def get_merchant_items(
    merchant_id: int,
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search term"),
    limit: int = Query(50, description="Maximum number of results"),
    skip: int = Query(0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """Get inventory items for a specific merchant"""
    # Verify merchant exists
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchant not found"
        )
    
    # Build query
    query = db.query(InventoryItem).filter(
        InventoryItem.merchant_id == merchant_id,
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0
    )
    
    if category:
        query = query.filter(InventoryItem.category == category)
    
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                InventoryItem.name.ilike(like),
                InventoryItem.description.ilike(like),
                InventoryItem.sku.ilike(like)
            )
        )
    
    items = query.offset(skip).limit(limit).all()
    return items


@router.get("/merchant/{merchant_id}/categories", response_model=List[str])
async def get_merchant_categories(
    merchant_id: int,
    db: Session = Depends(get_db)
):
    """Get all categories for a specific merchant"""
    # Verify merchant exists
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Merchant not found"
        )
    
    categories = db.query(InventoryItem.category).filter(
        InventoryItem.merchant_id == merchant_id,
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0,
        InventoryItem.category.isnot(None)
    ).distinct().all()
    
    return [cat[0] for cat in categories if cat[0]]


@router.get("/stats", response_model=Dict[str, Any])
async def get_marketplace_stats(
    db: Session = Depends(get_db)
):
    """Get marketplace statistics"""
    # Total merchants with inventory
    total_merchants = db.query(Merchant).join(InventoryItem).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0
    ).distinct().count()
    
    # Total active items
    total_items = db.query(InventoryItem).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0
    ).count()
    
    # Total categories
    total_categories = db.query(InventoryItem.category).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0,
        InventoryItem.category.isnot(None)
    ).distinct().count()
    
    # Average price
    avg_price = db.query(func.avg(InventoryItem.unit_price)).filter(
        InventoryItem.is_active == True,
        InventoryItem.current_quantity > 0,
        InventoryItem.unit_price.isnot(None)
    ).scalar() or 0
    
    return {
        "total_merchants": total_merchants,
        "total_items": total_items,
        "total_categories": total_categories,
        "average_price": round(float(avg_price), 2)
    }
