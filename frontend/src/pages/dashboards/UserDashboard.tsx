import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface MerchantData {
  merchant_id: number;
  merchant_name: string;
  business_name: string;
  city: string;
  state: string;
  total_spent: number;
  total_pending: number;
  transaction_count: number;
  last_transaction: string | null;
}

interface SpendingAnalytics {
  period: string;
  daily_spending: { [key: string]: number };
  weekly_spending: { [key: string]: number };
  monthly_spending: { [key: string]: number };
  total_daily: number;
  total_weekly: number;
  total_monthly: number;
}

interface Transaction {
  transaction_id: number;
  amount: number;
  status: string;
  payment_method: string;
  description: string;
  datetime: string;
  merchant_name: string;
}

const UserDashboard = () => {
  const { user, logout, token } = useAuth();
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [spendingAnalytics, setSpendingAnalytics] = useState<SpendingAnalytics | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && token) {
      loadDashboardData();
      loadSpendingAnalytics();
    }
  }, [user, token]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const merchantsData = await apiService.getUserMerchantsWithPending(token!);
      setMerchants(merchantsData);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpendingAnalytics = async () => {
    try {
      const analyticsData = await apiService.getUserSpendingAnalytics(token!, 'monthly');
      setSpendingAnalytics(analyticsData);
    } catch (err) {
      setError('Failed to load spending analytics');
      console.error('Analytics load error:', err);
    }
  };

  const loadMerchantTransactions = async (merchantId: number) => {
    try {
      const transactionsData = await apiService.getUserTransactionsByMerchant(token!, merchantId);
      setTransactions(transactionsData);
      setSelectedMerchant(merchantId);
    } catch (err) {
      setError('Failed to load transactions');
      console.error('Transactions load error:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'payed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'payed':
        return 'Paid';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user.name}!
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Track your spending and manage your merchant accounts
              </p>
            </div>
            <button
              onClick={logout}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <span className="text-red-600 dark:text-red-400 mr-2">⚠️</span>
                <span className="text-red-800 dark:text-red-200">{error}</span>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Spent
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {formatCurrency(merchants.reduce((sum, m) => sum + m.total_spent, 0))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Pending Bills
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {formatCurrency(merchants.reduce((sum, m) => sum + m.total_pending, 0))}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Merchants
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {merchants.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Transactions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900 dark:text-white">
                        {merchants.reduce((sum, m) => sum + m.transaction_count, 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spending Analytics */}
          {spendingAnalytics && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Spending Analytics
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Your spending breakdown across different time periods
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(spendingAnalytics.total_daily)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Last 7 Days
                      {Object.keys(spendingAnalytics.daily_spending).length > 0 && (
                        <div className="text-xs mt-1">
                          {Object.keys(spendingAnalytics.daily_spending).length} days with transactions
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(spendingAnalytics.total_weekly)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Last 4 Weeks
                      {Object.keys(spendingAnalytics.weekly_spending).length > 0 && (
                        <div className="text-xs mt-1">
                          {Object.keys(spendingAnalytics.weekly_spending).length} weeks with transactions
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(spendingAnalytics.total_monthly)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Last 12 Months
                      {Object.keys(spendingAnalytics.monthly_spending).length > 0 && (
                        <div className="text-xs mt-1">
                          {Object.keys(spendingAnalytics.monthly_spending).length} months with transactions
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Merchants with Pending Amounts */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Your Merchants & Pending Amounts
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Merchants you have transacted with and their pending amounts
              </p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {merchants.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <div className="text-4xl mb-2">🏪</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No merchants found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    You haven't transacted with any merchants yet.
                  </p>
                </div>
              ) : (
                merchants.map((merchant) => (
                  <div key={merchant.merchant_id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {merchant.business_name}
                          </h4>
                          <button
                            onClick={() => loadMerchantTransactions(merchant.merchant_id)}
                            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            View Transactions
                          </button>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {merchant.city && merchant.state ? `${merchant.city}, ${merchant.state}` : 'Local Merchant'}
                        </p>
                        <div className="mt-2 flex space-x-6 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Total Spent: </span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {formatCurrency(merchant.total_spent)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Pending: </span>
                            <span className={`font-medium ${merchant.total_pending > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {formatCurrency(merchant.total_pending)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Transactions: </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {merchant.transaction_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Transaction History for Selected Merchant */}
          {selectedMerchant && transactions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Transaction History
                  </h3>
                  <button
                    onClick={() => setSelectedMerchant(null)}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Transactions with {transactions[0]?.merchant_name}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {transactions.map((transaction) => (
                      <tr key={transaction.transaction_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatDate(transaction.datetime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                            {getStatusText(transaction.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {transaction.payment_method || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {transaction.description || 'No description'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;
