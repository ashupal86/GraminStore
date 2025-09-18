import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface DashboardStats {
  total_sales: number;
  total_transactions: number;
  total_pending: number;
  avg_transaction: number;
  guest_users_count: number;
  recent_transactions: any[];
}

interface Transaction {
  transaction_id: number;
  user_id: number | null;
  guest_user_id: number | null;
  timestamp: string;
  amount: number;
  type: string;
  description: string;
  payment_method: string;
  reference_number: string;
  user_details?: {
    name: string;
    phone_last_4: string;
    email: string;
  };
}

interface TopCustomer {
  user_id?: number;
  guest_user_id?: number;
  total_amount: number;
  transaction_count: number;
  type: 'registered' | 'guest';
}

const ComprehensiveDashboard: React.FC = () => {
  const { merchant, token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [detailedAnalytics, setDetailedAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'total'>('monthly');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  const itemsPerPage = 10;

  useEffect(() => {
    loadDashboardData();
    setupWebSocket();
    
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [timeRange]);

  const setupWebSocket = () => {
    if (token) {
      const ws = apiService.createWebSocketConnection(token);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnection(ws);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Real-time update:', data);
        // Refresh dashboard data when new transaction is received
        loadDashboardData();
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnection(null);
      };
    }
  };

  const loadDashboardData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const days = timeRange === 'daily' ? 1 : timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 365;
      
      const [dashboardData, transactionsData, topCustomersData, analyticsData] = await Promise.all([
        apiService.getMerchantDashboard(token, days),
        apiService.getTransactionHistory(token, itemsPerPage, (currentPage - 1) * itemsPerPage, days),
        apiService.getTopCustomers(token, 5),
        apiService.getDetailedAnalytics(token, timeRange)
      ]);

      setStats(dashboardData);
      setTransactions(transactionsData);
      setTopCustomers(topCustomersData);
      setDetailedAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'daily': return 'Today';
      case 'weekly': return 'This Week';
      case 'monthly': return 'This Month';
      case 'total': return 'All Time';
      default: return 'This Month';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {merchant?.name || 'Merchant'} Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Comprehensive analytics and transaction management
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6">
          <div className="flex space-x-2">
            {['daily', 'weekly', 'monthly', 'total'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.total_sales)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.total_transactions.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Later Amount</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.total_pending)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Pay Later</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Transaction</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.avg_transaction)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Per Transaction</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Growth Metrics */}
        {detailedAnalytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sales Growth</h3>
              <div className="flex items-center">
                <div className={`text-3xl font-bold ${detailedAnalytics.growth.sales_growth_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {detailedAnalytics.growth.sales_growth_percent >= 0 ? '+' : ''}{detailedAnalytics.growth.sales_growth_percent}%
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">vs Previous Period</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction Growth</h3>
              <div className="flex items-center">
                <div className={`text-3xl font-bold ${detailedAnalytics.growth.transaction_growth_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {detailedAnalytics.growth.transaction_growth_percent >= 0 ? '+' : ''}{detailedAnalytics.growth.transaction_growth_percent}%
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">vs Previous Period</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Unique Customers</h3>
              <div className="flex items-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {detailedAnalytics.summary.unique_customers}
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Registered users</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guest Customers</h3>
              <div className="flex items-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {detailedAnalytics.summary.guest_customers}
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">One-time customers</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{getTimeRangeLabel()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods section removed as requested */}

        {/* WebSocket Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Real-time Status</h3>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${wsConnection ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {wsConnection ? 'Connected' : 'Disconnected'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Live transaction updates</p>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        {topCustomers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Customers</h3>
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {index + 1}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.type === 'registered' ? `User #${customer.user_id}` : `Guest #${customer.guest_user_id}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {customer.transaction_count} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(customer.total_amount)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {customer.type === 'registered' ? 'Registered' : 'Guest'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((transaction) => (
                  <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {transaction.reference_number}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {transaction.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {transaction.user_details ? (
                          <div>
                            <div className="font-medium">{transaction.user_details.name}</div>
                            <div className="text-gray-500">****{transaction.user_details.phone_last_4}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium">Guest</div>
                            <div className="text-gray-500">****</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(transaction.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const isPayed = transaction.type === 'payed' || transaction.type === 'PAYED';
                        return (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            isPayed
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {isPayed ? 'Payed' : 'Later'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(transaction.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Showing page {currentPage} of transactions
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={transactions.length < itemsPerPage}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveDashboard;
