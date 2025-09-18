import { useState, useEffect } from 'react';
import { db, type Transaction } from '../services/indexedDB';

interface TransactionHistoryProps {
  merchantId: number;
  userPhone: string;
  isVisible: boolean;
  onClose: () => void;
}

const TransactionHistory = ({ merchantId, userPhone, isVisible, onClose }: TransactionHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible && userPhone) {
      loadTransactionHistory();
    }
  }, [isVisible, userPhone, merchantId]);

  const loadTransactionHistory = async () => {
    setLoading(true);
    try {
      const history = await db.getUserTransactionHistory(merchantId, userPhone, 20);
      setTransactions(history);
    } catch (error) {
      console.error('Error loading transaction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      case 'cancelled':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getPaymentTypeIcon = (paymentType: Transaction['paymentType']) => {
    return paymentType === 'instant' ? '💳' : '📝';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg mx-4 shadow-2xl max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction History</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No transactions found
              </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getPaymentTypeIcon(transaction.paymentType)}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₹{transaction.amount.toFixed(2)}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status === 'completed' ? 'Payed' : transaction.status === 'pending' ? 'Later' : 'Cancelled'}
                    </span>
                  </div>
                  
                  {transaction.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {transaction.description}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(transaction.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
