import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { wsService } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';
import type { Category, MarketplaceState, SearchResult, CartItem, InventoryItem } from '../types/marketplace';

const MarketplacePage = () => {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [state, setState] = useState<MarketplaceState>({
    merchants: [],
    categories: [],
    selectedCategory: null,
    selectedMerchant: null,
    searchResults: [],
    cart: [],
    loading: false,
    error: null,
    searchQuery: '',
    viewMode: 'merchants',
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Category mapping with icons and colors
  const categoryMapping: Record<string, Category> = {
    'vegetables': { name: 'vegetables', displayName: 'Vegetables', icon: '🥬', color: 'bg-green-100 text-green-800' },
    'fruits': { name: 'fruits', displayName: 'Fruits', icon: '🍎', color: 'bg-red-100 text-red-800' },
    'pulses': { name: 'pulses', displayName: 'Pulses', icon: '🫘', color: 'bg-yellow-100 text-yellow-800' },
    'flour': { name: 'flour', displayName: 'Flour & Grains', icon: '🌾', color: 'bg-amber-100 text-amber-800' },
    'medicines': { name: 'medicines', displayName: 'Medicines', icon: '💊', color: 'bg-blue-100 text-blue-800' },
    'dairy': { name: 'dairy', displayName: 'Dairy Products', icon: '🥛', color: 'bg-cyan-100 text-cyan-800' },
    'spices': { name: 'spices', displayName: 'Spices', icon: '🌶️', color: 'bg-orange-100 text-orange-800' },
    'snacks': { name: 'snacks', displayName: 'Snacks', icon: '🍿', color: 'bg-indigo-100 text-indigo-800' },
    'beverages': { name: 'beverages', displayName: 'Beverages', icon: '🥤', color: 'bg-purple-100 text-purple-800' },
    'household': { name: 'household', displayName: 'Household Items', icon: '🏠', color: 'bg-gray-100 text-gray-800' },
  };

  // Load merchants and categories on component mount
  useEffect(() => {
    loadMerchants();
    loadCategories();
  }, []);

  // Setup websocket connection for order updates (only for logged-in users)
  useEffect(() => {
    if (token) {
      const connectWebSocket = async () => {
        try {
          await wsService.connect(token);
          console.log('WebSocket connected for order updates');
        } catch (error) {
          console.error('Failed to connect WebSocket:', error);
        }
      };

      connectWebSocket();

      // Listen for new orders
      const unsubscribeNewOrder = wsService.subscribe('new_order', (data) => {
        console.log('New order received:', data);
        // You can add notification logic here
      });

      // Listen for order updates
      const unsubscribeOrderUpdate = wsService.subscribe('orders_update', (data) => {
        console.log('Orders updated:', data);
        // You can add UI update logic here
      });

      return () => {
        unsubscribeNewOrder();
        unsubscribeOrderUpdate();
        wsService.disconnect();
      };
    }
  }, [token]);

  const loadMerchants = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const merchants = await apiService.getMerchantsWithInventory();
      console.log('Loaded merchants:', merchants);
      setState(prev => ({ ...prev, merchants, loading: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to load merchants', 
        loading: false 
      }));
    }
  };

  const loadCategories = async () => {
    try {
      const categories = await apiService.getAllCategories();
      const mappedCategories = categories.map(cat => 
        categoryMapping[cat] || {
          name: cat,
          displayName: cat.charAt(0).toUpperCase() + cat.slice(1),
          icon: '🛍️',
          color: 'bg-gray-100 text-gray-800'
        }
      );
      setState(prev => ({ ...prev, categories: mappedCategories }));
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, searchResults: [], viewMode: 'merchants' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null, searchQuery: query }));
      const results = await apiService.searchItemsAcrossMerchants(query);
      setState(prev => ({ 
        ...prev, 
        searchResults: results, 
        loading: false, 
        viewMode: 'search' 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to search items', 
        loading: false 
      }));
    }
  }, []);

  const addToCart = (item: InventoryItem | SearchResult, merchantName: string) => {
    const existingItem = state.cart.find(cartItem => cartItem.id === item.id);
    
    if (existingItem) {
      setState(prev => ({
        ...prev,
        cart: prev.cart.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }));
    } else {
      const newCartItem: CartItem = {
        id: item.id,
        name: item.name,
        unit_price: item.unit_price,
        quantity: 1,
        unit: item.unit,
        merchant_id: 'merchant' in item ? item.merchant.id : (item as InventoryItem).merchant_id,
        merchant_name: merchantName,
        category: item.category || 'general'
      };
      
      setState(prev => ({
        ...prev,
        cart: [...prev.cart, newCartItem]
      }));
      
      console.log('Added item to cart:', newCartItem);
    }
  };

  const removeFromCart = (itemId: number) => {
    setState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.id !== itemId)
    }));
  };

  const updateCartQuantity = (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setState(prev => ({
      ...prev,
      cart: prev.cart.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    }));
  };

  const handleCheckout = async () => {
    if (state.cart.length === 0) {
      setState(prev => ({ ...prev, error: 'Cart is empty' }));
      return;
    }

    setIsCheckingOut(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      console.log('Current cart state:', state.cart);
      console.log('Cart item types:', state.cart.map(item => ({
        id: typeof item.id,
        name: typeof item.name,
        category: typeof item.category,
        unit_price: typeof item.unit_price,
        quantity: typeof item.quantity,
        merchant_id: typeof item.merchant_id
      })));
      
      // Validate and clean cart items
      const validatedCartItems = state.cart
        .filter(item => {
          // More strict validation
          return item && 
                 typeof item.id === 'number' && 
                 typeof item.name === 'string' && 
                 item.name.trim() !== '' &&
                 typeof item.unit_price === 'number' &&
                 typeof item.quantity === 'number' &&
                 typeof item.merchant_id === 'number';
        })
        .map(item => {
          // Ensure all fields are properly typed
          const validatedItem = {
            id: Number(item.id),
            name: String(item.name).trim(),
            unit_price: Number(item.unit_price),
            quantity: Number(item.quantity),
            unit: String(item.unit || 'piece'),
            merchant_id: Number(item.merchant_id),
            merchant_name: String(item.merchant_name || 'Unknown Merchant'),
            category: String(item.category || 'general')
          };
          
          console.log('Validated item:', validatedItem);
          return validatedItem;
        });

      const checkoutData = {
        cart_items: validatedCartItems,
        payment_method: 'online',
        customer_name: user?.name || 'Guest Customer',
        customer_phone: user?.phone || null,
        is_guest_order: !user
      };

      console.log('Checkout data being sent:', checkoutData);
      console.log('Cart items validation:', validatedCartItems);

      // Check if we have valid cart items
      if (validatedCartItems.length === 0) {
        throw new Error('No valid items in cart');
      }

      // Use token if available, otherwise pass null for guest checkout
      const response = await apiService.processCheckout(checkoutData, token || '');
      
      setCheckoutSuccess(true);
      setState(prev => ({ ...prev, cart: [] }));
      
      // Show success message for 3 seconds
      setTimeout(() => {
        setCheckoutSuccess(false);
      }, 3000);

      console.log('Checkout successful:', response);
    } catch (error: any) {
      console.error('Checkout failed:', error);
      setState(prev => ({ 
        ...prev, 
        error: error.message || 'Checkout failed. Please try again.' 
      }));
    } finally {
      setIsCheckingOut(false);
    }
  };

  const InventoryItemCard = ({ item, merchantName }: { item: InventoryItem; merchantName: string }) => {
    const cartItem = state.cart.find(cartItem => cartItem.id === item.id);
    const quantity = cartItem?.quantity || 0;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
              {item.name}
            </h3>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
              {item.sku}
            </span>
          </div>
          
          {item.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {item.description}
            </p>
          )}
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                ₹{item.unit_price}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                per {item.unit}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Stock: {item.current_quantity}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            {quantity > 0 ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateCartQuantity(item.id, quantity - 1)}
                  className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                <button
                  onClick={() => updateCartQuantity(item.id, quantity + 1)}
                  disabled={quantity >= item.current_quantity}
                  className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={() => addToCart(item, merchantName)}
                disabled={item.current_quantity === 0}
                className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {item.current_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SearchResultCard = ({ item }: { item: SearchResult }) => {
    const cartItem = state.cart.find(cartItem => cartItem.id === item.id);
    const quantity = cartItem?.quantity || 0;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2">
              {item.name}
            </h3>
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
              {item.merchant.business_name}
            </span>
          </div>
          
          {item.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
              {item.description}
            </p>
          )}
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                ₹{item.unit_price}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                per {item.unit}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Stock: {item.current_quantity}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            {quantity > 0 ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateCartQuantity(item.id, quantity - 1)}
                  className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  -
                </button>
                <span className="text-sm font-medium w-8 text-center">{quantity}</span>
                <button
                  onClick={() => updateCartQuantity(item.id, quantity + 1)}
                  disabled={quantity >= item.current_quantity}
                  className="w-8 h-8 bg-slate-600 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={() => addToCart(item, item.merchant.business_name)}
                disabled={item.current_quantity === 0}
                className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {item.current_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LoadingSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden animate-pulse">
          <div className="p-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );

  const CartSidebar = () => {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = state.cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    return (
      <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out z-50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cart ({totalItems})
            </h3>
            <button
              onClick={() => setState(prev => ({ ...prev, cart: [] }))}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear All
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {state.cart.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🛒</div>
              <p className="text-gray-500 dark:text-gray-400">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {state.cart.map((item) => (
                <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {item.name}
                    </h4>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {item.merchant_name} • {item.category}
                  </p>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-full flex items-center justify-center text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        -
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 bg-slate-600 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-slate-700"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      ₹{(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {state.cart.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                Total: ₹{totalPrice.toFixed(2)}
              </span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200"
            >
              {isCheckingOut ? 'Processing...' : 'Proceed to Checkout'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t('nav.marketplace')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Shop from local merchants in your area
              </p>
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, cart: [] }))}
              className="relative bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              🛒 Cart ({state.cart.reduce((sum, item) => sum + item.quantity, 0)})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for items across all merchants..."
              value={state.searchQuery}
              onChange={(e) => {
                const query = e.target.value;
                setState(prev => ({ ...prev, searchQuery: query }));
                if (query.trim()) {
                  handleSearch(query);
                } else {
                  setState(prev => ({ ...prev, searchResults: [], viewMode: 'merchants' }));
                }
              }}
              className="w-full px-4 py-3 pl-10 pr-4 text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
        </div>

        {/* Success State */}
        {checkoutSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-green-600 dark:text-green-400 mr-2">✅</span>
              <span className="text-green-800 dark:text-green-200">Order placed successfully! The merchant will receive your order.</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-600 dark:text-red-400 mr-2">⚠️</span>
              <span className="text-red-800 dark:text-red-200">{state.error}</span>
            </div>
          </div>
        )}

        {/* Content */}
        {state.loading && state.merchants.length === 0 && state.searchResults.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <>
            {state.viewMode === 'search' ? (
              /* Search Results */
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Search Results for "{state.searchQuery}" ({state.searchResults.length})
                </h2>
                {state.searchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No items found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Try searching with different keywords.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {state.searchResults.map((item) => (
                      <SearchResultCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Merchants View */
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Local Merchants ({state.merchants.length})
                </h2>
                {state.merchants.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏪</div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No merchants found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      No merchants have inventory available at the moment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {state.merchants.map((merchant) => (
                      <div key={merchant.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {merchant.business_name}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            {merchant.city && merchant.state ? `${merchant.city}, ${merchant.state}` : 'Local Merchant'}
                          </p>
                        </div>
                        
                        <div className="p-6">
                          {Object.entries(merchant.categories).map(([categoryName, items]) => {
                            const category = state.categories.find(cat => cat.name === categoryName);
                            return (
                              <div key={categoryName} className="mb-8">
                                <div className="flex items-center mb-4">
                                  <span className="text-2xl mr-2">{category?.icon || '🛍️'}</span>
                                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {category?.displayName || categoryName}
                                  </h4>
                                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                    ({items.length} items)
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                  {items.map((item) => (
                                    <InventoryItemCard 
                                      key={item.id} 
                                      item={item} 
                                      merchantName={merchant.business_name} 
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart Sidebar */}
      {state.cart.length > 0 && <CartSidebar />}
    </div>
  );
};

export default MarketplacePage;
