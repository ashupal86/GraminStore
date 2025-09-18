import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import { apiService } from '../services/api';

interface InventoryItem {
  id: number;
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  current_quantity: number;
  min_quantity: number;
  unit_price?: number;
  unit: string;
  is_active: boolean;
  is_low_stock: boolean;
  created_at: string;
  updated_at?: string;
}

interface InventoryStats {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  total_value: number;
  categories: string[];
}

interface PurchaseListItem {
  id: number;
  inventory_item_id: number;
  quantity_needed: number;
  is_purchased: boolean;
  created_at: string;
  inventory_item: InventoryItem;
}

const InventoryPage = () => {
  const { merchant, token } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [purchaseList, setPurchaseList] = useState<PurchaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseResults, setBrowseResults] = useState<any[]>([]);
  const [pendingCatalogItem, setPendingCatalogItem] = useState<any | null>(null);
  const [detailForm, setDetailForm] = useState({
    amount: '',
    quantity: 1,
    description: '',
    ingredients: ''
  });
  const [quantityModal, setQuantityModal] = useState<{show: boolean, item: any, quantity: number}>({
    show: false,
    item: null,
    quantity: 1
  });

  const openDetailsForProduct = (prod: any) => {
    setPendingCatalogItem(prod);
    setDetailForm({
      amount: '',
      quantity: 1,
      description: prod.generic_name || prod.product_name || '',
      ingredients: prod.ingredients_text || prod.ingredients_text_en || ''
    });
  };

  const submitDetailsAdd = async () => {
    if (!pendingCatalogItem || !token) return;
    const name = pendingCatalogItem.product_name || pendingCatalogItem.generic_name || pendingCatalogItem.brands || 'Unnamed Item';
    const sku = pendingCatalogItem.code || pendingCatalogItem._id || undefined;
    const qty = Number(detailForm.quantity) || 1;
    const price = detailForm.amount ? Number(detailForm.amount) : undefined;
    try {
      await apiService.post('/api/v1/inventory/items', {
        name,
        sku,
        current_quantity: qty,
        min_quantity: 5,
        unit_price: price,
        unit: 'pieces',
        description: detailForm.description
      }, token);
      setPendingCatalogItem(null);
      await fetchInventoryData();
    } catch (e) {
      console.error('Error adding item from details modal:', e);
    }
  };

  const handleQuantityAdd = async () => {
    if (!token || !quantityModal.item) return;
    try {
      await apiService.post(`/api/v1/inventory/items/${quantityModal.item.id}/quantity`, {
        quantity_change: quantityModal.quantity,
        reason: 'QR scan add'
      }, token);
      setQuantityModal({ show: false, item: null, quantity: 1 });
      await fetchInventoryData();
    } catch (error) {
      console.error('Error adding quantity:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInventoryData();
    }
  }, [token]);


  const fetchInventoryData = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      const [itemsRes, statsRes, purchaseRes] = await Promise.all([
        apiService.get('/api/v1/inventory/items', token),
        apiService.get('/api/v1/inventory/stats', token),
        apiService.get('/api/v1/inventory/purchase-list', token)
      ]);
      
      setItems(itemsRes.data);
      setStats(statsRes.data);
      setPurchaseList(purchaseRes.data.items);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Removed unused handleAddItem function

  const handleQuantityUpdate = async (itemId: number, change: number, reason?: string) => {
    if (!token) return;
    try {
      await apiService.post(`/api/v1/inventory/items/${itemId}/quantity`, {
        quantity_change: change,
        reason: reason || 'Manual adjustment'
      }, token);
      fetchInventoryData();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleDownloadPurchaseList = async () => {
    if (!token || !purchaseList.length) return;
    
    try {
      // Create PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Colors
      const primaryColor = [41, 128, 185] as const; // Blue
      const secondaryColor = [52, 73, 94] as const; // Dark gray
      const lightGray = [236, 240, 241] as const;
      
      // Header
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PURCHASE LIST', 20, 25);
      
      // Store info
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Store: ${merchant?.business_name || 'Merchant Store'}`, 20, 50);
      pdf.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 20, 60);
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 20, 70);
      
      // Summary box
      pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.rect(20, 80, pageWidth - 40, 30, 'F');
      
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('SUMMARY', 25, 95);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Total Items: ${purchaseList.length}`, 25, 105);
      
      const totalQuantity = purchaseList.reduce((sum, item) => sum + item.quantity_needed, 0);
      pdf.text(`Total Quantity: ${totalQuantity} pieces`, 25, 112);
      
      // Items table header
      let yPosition = 130;
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(20, yPosition, pageWidth - 40, 15, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ITEM NAME', 25, yPosition + 10);
      pdf.text('SKU', 100, yPosition + 10);
      pdf.text('QTY NEEDED', 140, yPosition + 10);
      pdf.text('CURRENT', 170, yPosition + 10);
      pdf.text('STATUS', 200, yPosition + 10);
      
      // Items list
      yPosition += 20;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      
      purchaseList.forEach((item, index) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 249, 250);
          pdf.rect(20, yPosition - 5, pageWidth - 40, 12, 'F');
        }
        
        pdf.setFontSize(9);
        pdf.text(item.inventory_item.name.substring(0, 30), 25, yPosition);
        pdf.text(item.inventory_item.sku || 'N/A', 100, yPosition);
        pdf.text(item.quantity_needed.toString(), 140, yPosition);
        pdf.text(item.inventory_item.current_quantity.toString(), 170, yPosition);
        
        // Status
        const status = item.inventory_item.current_quantity === 0 ? 'OUT' : 'LOW';
        const statusColor = status === 'OUT' ? [231, 76, 60] : [230, 126, 34];
        pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        pdf.text(status, 200, yPosition);
        pdf.setTextColor(0, 0, 0);
        
        yPosition += 12;
      });
      
      // Footer
      yPosition = Math.max(yPosition + 20, pageHeight - 30);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, yPosition, pageWidth - 20, yPosition);
      
      pdf.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Generated by GraminStore Inventory Management System', 20, yPosition + 10);
      pdf.text(`Page 1 of 1`, pageWidth - 50, yPosition + 10);
      
      // Save PDF
      const fileName = `purchase_list_${merchant?.business_name?.replace(/\s+/g, '_') || 'store'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to CSV if PDF generation fails
      try {
        const response = await fetch(`${apiService.baseURL}/api/v1/inventory/purchase-list/download`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const blob = new Blob([csvText], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `purchase_list_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (csvError) {
        console.error('Error downloading CSV fallback:', csvError);
      }
    }
  };


  const searchCatalog = async () => {
    if (!browseQuery.trim()) return;
    try {
      setBrowseLoading(true);
      const products = await apiService.offSearchProducts(browseQuery, 1, 20);
      setBrowseResults(products);
    } catch (e) {
      console.error('Browse search error:', e);
    } finally {
      setBrowseLoading(false);
    }
  };

  // Removed unused addFromCatalog function

  const addToPurchaseList = async (itemId: number) => {
    if (!token) return;
    try {
      // Get current item details
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      
      // Calculate quantity needed (min_quantity - current_quantity)
      const quantityNeeded = Math.max(0, item.min_quantity - item.current_quantity);
      
      if (quantityNeeded <= 0) {
        // Already sufficient stock; skip adding
        return;
      }
      
      // Add to purchase list by creating a purchase list item
      await apiService.post('/api/v1/inventory/purchase-list', {
        inventory_item_id: itemId,
        quantity_needed: quantityNeeded
      }, token);
      
      await fetchInventoryData();
    } catch (e) {
      console.error('Error adding to purchase list:', e);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || item.is_low_stock;
    
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your store inventory and track stock levels
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <span className="text-2xl">📦</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_items}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.low_stock_items}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                  <span className="text-2xl">❌</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.out_of_stock_items}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">₹{stats.total_value.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchase List Alert */}
        {purchaseList.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🛒</span>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
                    Purchase List Ready
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    {purchaseList.length} items need restocking
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadPurchaseList}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>📄</span>
                Download PDF
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">All Categories</option>
                {stats?.categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Low Stock Only</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBrowse(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
          {filteredItems.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-300 py-8">
              No items found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Min</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purchase</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className={item.is_low_stock ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.sku || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.current_quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.min_quantity}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleQuantityUpdate(item.id, +1, 'Manual +1')} className="px-2 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded">+1</button>
                          <button onClick={() => handleQuantityUpdate(item.id, -1, 'Manual -1')} className="px-2 py-1 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded">-1</button>
                          <button onClick={() => {
                            const val = prompt(`Adjust quantity for ${item.name} (+/- number)`);
                            if (!val) return;
                            const n = parseInt(val);
                            if (Number.isNaN(n) || n === 0) return;
                            handleQuantityUpdate(item.id, n, 'Manual adjust');
                          }} className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded">Custom</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => addToPurchaseList(item.id)} className="px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded">Add to Buy List</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {showBrowse && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-2xl relative">
              <button
                onClick={() => setShowBrowse(false)}
                className="absolute right-3 top-3 text-gray-600 dark:text-gray-300"
              >✕</button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Browse Items</h3>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={browseQuery}
                  onChange={(e) => setBrowseQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={searchCatalog}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium"
                >Search</button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {browseLoading ? (
                  <div className="py-8 text-center text-gray-600 dark:text-gray-300">Searching...</div>
                ) : browseResults.length === 0 ? (
                  <div className="py-8 text-center text-gray-600 dark:text-gray-300">No results</div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {browseResults.map((p) => (
                      <li key={p.code || p._id || p.id} className="py-3 flex items-center gap-3">
                        {p.image_small_url ? (
                          <img src={p.image_small_url} alt="" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{p.product_name || p.generic_name || 'Unnamed'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Brand: {p.brands || 'N/A'} • Code: {p.code || 'N/A'}</div>
                        </div>
                        <button
                          onClick={() => openDetailsForProduct(p)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded"
                        >Add</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {pendingCatalogItem && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg relative">
              <button
                onClick={() => setPendingCatalogItem(null)}
                className="absolute right-4 top-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 text-xl"
              >✕</button>
              
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Item to Inventory</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {pendingCatalogItem.code ? `Scanned Code: ${pendingCatalogItem.code}` : 'Manual Entry'}
                </p>
              </div>

              {/* Item Preview */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-4">
                  {pendingCatalogItem.image_small_url ? (
                    <img 
                      src={pendingCatalogItem.image_small_url} 
                      alt="Product" 
                      className="w-16 h-16 object-cover rounded-lg" 
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {pendingCatalogItem.product_name || pendingCatalogItem.generic_name || 'Unnamed Item'}
                    </h4>
                    {pendingCatalogItem.brands && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Brand: {pendingCatalogItem.brands}</p>
                    )}
                    {pendingCatalogItem.code && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">Code: {pendingCatalogItem.code}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter price per unit"
                    value={detailForm.amount}
                    onChange={(e) => setDetailForm({ ...detailForm, amount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={detailForm.quantity}
                    onChange={(e) => setDetailForm({ ...detailForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Enter item description"
                    value={detailForm.description}
                    onChange={(e) => setDetailForm({ ...detailForm, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ingredients</label>
                  <textarea
                    rows={3}
                    placeholder="Enter ingredients (if applicable)"
                    value={detailForm.ingredients}
                    onChange={(e) => setDetailForm({ ...detailForm, ingredients: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fetched from product database when available</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  onClick={() => setPendingCatalogItem(null)}
                  className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDetailsAdd}
                  className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Add to Inventory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Modal */}
        {quantityModal.show && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md relative">
              <button
                onClick={() => setQuantityModal({ show: false, item: null, quantity: 1 })}
                className="absolute right-4 top-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 text-xl"
              >✕</button>
              
              <div className="text-center mb-6">
                <div className="text-3xl mb-2">📦</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Quantity</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Item already exists in inventory
                </p>
              </div>

              {/* Item Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {quantityModal.item.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  SKU: {quantityModal.item.sku || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Current Stock: {quantityModal.item.current_quantity} pieces
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantity to Add
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityModal.quantity}
                    onChange={(e) => setQuantityModal({
                      ...quantityModal,
                      quantity: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  onClick={() => setQuantityModal({ show: false, item: null, quantity: 1 })}
                  className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuantityAdd}
                  className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Add to Inventory
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default InventoryPage;
