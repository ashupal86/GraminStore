import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface GuestUserTransaction {
  id: number;
  merchant_id: number;
  transaction_id: number;
  timestamp: string;
  transaction_details?: {
    transaction_id: number;
    amount: number;
    type: string;
    description?: string;
    timestamp: string;
    payment_status: string;
  };
}

interface GuestUserSalesModalProps {
  isVisible: boolean;
  onClose: () => void;
  merchantId: number;
  token: string;
}

const GuestUserSalesModal: React.FC<GuestUserSalesModalProps> = ({
  isVisible,
  onClose,
  merchantId,
  token
}) => {
  const [guestUsers, setGuestUsers] = useState<GuestUserTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSales, setTotalSales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    if (isVisible) {
      loadGuestUserSales();
    }
  }, [isVisible, merchantId, token]);

  const loadGuestUserSales = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getGuestUsers(token);
      setGuestUsers(data);
      
      // Calculate totals
      const sales = data.reduce((sum, guest) => {
        return sum + (guest.transaction_details?.amount || 0);
      }, 0);
      setTotalSales(sales);
      setTotalTransactions(data.length);
    } catch (err: any) {
      setError(err?.message || 'Failed to load guest user sales');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
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

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Guest User Sales Report
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Total Guest Transactions
              </div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {totalTransactions}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                Total Sales Amount
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {formatCurrency(totalSales)}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-sm font-medium text-purple-600 dark:text-purple-400">
                Average Transaction
              </div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {totalTransactions > 0 ? formatCurrency(totalSales / totalTransactions) : '₹0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              Loading guest user sales...
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-500 mb-4">⚠️</div>
              <div className="text-red-600 dark:text-red-400">{error}</div>
              <button
                onClick={loadGuestUserSales}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : guestUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-lg font-medium mb-2">No Guest Transactions Yet</div>
              <div className="text-sm">Guest transactions will appear here when customers make purchases without registering.</div>
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-3">
                {guestUsers.map((guest) => (
                  <div
                    key={guest.id}
                    className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 dark:text-gray-300 font-semibold">
                            👤
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            Guest Transaction #{guest.transaction_id}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(guest.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {guest.transaction_details ? formatCurrency(guest.transaction_details.amount) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {guest.transaction_details?.type || 'Unknown'}
                        </div>
                      </div>
                    </div>
                    {guest.transaction_details?.description && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                        {guest.transaction_details.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestUserSalesModal;
