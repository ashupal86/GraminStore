import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { wsService } from '../services/websocket';
import { pushNotificationService } from '../services/pushNotifications';
import OrderNotificationModal from '../components/OrderNotificationModal';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
}

interface Order {
  order_id: string;
  transaction_id: number;
  user_id: number | null;
  merchant_id: number;
  amount: number;
  items: OrderItem[];
  customer_name: string;
  customer_phone: string | null;
  payment_method: string;
  is_guest_order: boolean;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
}

interface NewOrderNotification {
  order_id: string;
  customer_name: string;
  amount: number;
  items_count: number;
  timestamp: string;
}

const OrdersPage = () => {
  const { t } = useTranslation();
  const { user, merchant, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [newOrderNotification, setNewOrderNotification] = useState<NewOrderNotification | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'cancelled'>('all');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load orders from API
  const loadOrders = async () => {
    console.log('Loading orders, merchant:', merchant, 'merchant_id:', merchant?.id);
    if (!merchant?.id) {
      console.log('No merchant_id found, skipping order load');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      console.log('Calling API for merchant_id:', merchant.id);
      const ordersData = await apiService.getMerchantOrders(merchant.id, token || '');
      console.log('Orders API response:', ordersData);
      setOrders(ordersData.orders || []);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Setup push notifications
  const setupPushNotifications = async () => {
    try {
      // Skip push notifications for now due to VAPID key issues
      console.log('Push notifications disabled for now');
      setPushEnabled(false);
    } catch (error) {
      console.error('Failed to setup push notifications:', error);
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await apiService.updateOrderStatus(orderId, status, token || '');
      await loadOrders(); // Refresh orders
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  // Handle order notification click
  const handleOrderNotificationClick = (orderId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    if (order) {
      setSelectedOrder(order);
      setIsModalOpen(true);
    }
  };

  // Handle view order
  const handleViewOrder = (orderId: string) => {
    const order = orders.find(o => o.order_id === orderId);
    if (order) {
      setSelectedOrder(order);
      setIsModalOpen(true);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
  };

  // Handle status update from modal
  const handleStatusUpdate = async (orderId: string, status: string) => {
    await updateOrderStatus(orderId, status);
    // Keep modal open to show updated status
  };

  // Setup WebSocket connection for live updates
  const setupWebSocket = async () => {
    console.log('Setting up WebSocket, token available:', !!token);
    if (token) {
      try {
        await wsService.connect(token);
        console.log('WebSocket connected for orders page');
        setWsConnected(true);
        
        // Listen for new orders
        wsService.subscribe('new_order', (data) => {
          console.log('New order received via WebSocket:', data);
          
          // Show notification
          setNewOrderNotification({
            order_id: data.data?.order_id || data.order_id,
            customer_name: data.data?.customer_name || data.customer_name,
            amount: data.data?.amount || data.amount,
            items_count: data.data?.items?.length || data.items?.length || 0,
            timestamp: data.data?.timestamp || data.timestamp
          });
          
          // Auto-hide notification after 5 seconds
          setTimeout(() => {
            setNewOrderNotification(null);
          }, 5000);
          
          // Refresh orders list
          loadOrders();
        });

        // Listen for order updates
        wsService.subscribe('orders_update', (data) => {
          console.log('Orders updated:', data);
          loadOrders();
        });

        // Listen for connection status
        wsService.subscribe('*', (data) => {
          if (data.type === 'pong') {
            setWsConnected(true);
          }
        });

        // Set up periodic ping
        const pingInterval = setInterval(() => {
          if (wsService.isConnected()) {
            wsService.ping();
          } else {
            setWsConnected(false);
          }
        }, 30000);

        return () => {
          clearInterval(pingInterval);
        };

      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setWsConnected(false);
      }
    }
  };

  useEffect(() => {
    if (merchant?.id) {
      loadOrders();
      setupWebSocket();
      setupPushNotifications();
    }

    return () => {
      wsService.disconnect();
    };
  }, [merchant?.id, token]);

  // Filter orders based on status
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      case 'processing':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
      case 'cancelled':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`;
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Format date
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('nav.orders')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Live order updates and management
              </p>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {wsConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
                
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full ${pushEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {pushEnabled ? 'Push ON' : 'Push OFF'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={loadOrders}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* New Order Notification */}
        {newOrderNotification && (
          <div 
            className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-6 animate-pulse cursor-pointer hover:bg-green-100 dark:hover:bg-green-800 transition-colors"
            onClick={() => handleOrderNotificationClick(newOrderNotification.order_id)}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  New Order Received! Click to view details
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Order #{newOrderNotification.order_id} from {newOrderNotification.customer_name} - 
                  {formatCurrency(newOrderNotification.amount)} ({newOrderNotification.items_count} items)
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNewOrderNotification(null);
                }}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'All Orders', count: orders.length },
              { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
              { key: 'processing', label: 'Processing', count: orders.filter(o => o.status === 'processing').length },
              { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'completed').length },
              { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading orders...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Error Loading Orders
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <button
                onClick={loadOrders}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Orders Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'all' 
                  ? 'No orders have been placed yet.' 
                  : `No ${filter} orders found.`
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <div key={order.order_id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Order #{order.order_id}
                        </h3>
                        <span className={getStatusBadge(order.status)}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {order.customer_name}
                          </p>
                          {order.customer_phone && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {order.customer_phone}
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(order.amount)}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Items</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {order.items.length} items
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Time</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDate(order.timestamp)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Order Items */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Order Items:
                        </h4>
                        <div className="space-y-2">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span className="text-gray-900 dark:text-white">
                                {item.name} x{item.quantity} {item.unit}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {formatCurrency(item.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      {order.status === 'pending' && (
                        <button 
                          onClick={() => updateOrderStatus(order.order_id, 'processing')}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                        >
                          Process
                        </button>
                      )}
                      {order.status === 'processing' && (
                        <button 
                          onClick={() => updateOrderStatus(order.order_id, 'completed')}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                        >
                          Complete
                        </button>
                      )}
                      <button 
                        onClick={() => handleViewOrder(order.order_id)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      <OrderNotificationModal
        order={selectedOrder}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUpdateStatus={handleStatusUpdate}
        onViewOrder={handleViewOrder}
      />
    </div>
  );
};

export default OrdersPage;
