import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../services/indexedDB';

interface Customer {
  id?: number;
  merchantId: number;
  name: string;
  phone?: string;
  email?: string;
  totalTransactions: number;
  totalAmount: number;
  lastTransactionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'failed';
  isGuest?: boolean;
  platformUserId?: number;
}

interface CustomerSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onAddNewCustomer: () => void;
  merchantId: number;
}

const CustomerSelectionModal: React.FC<CustomerSelectionModalProps> = ({
  isVisible,
  onClose,
  onSelectCustomer,
  onAddNewCustomer,
  merchantId
}) => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadCustomers();
    }
  }, [isVisible, merchantId]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const allCustomers = await db.getCustomersByMerchant(merchantId);
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.includes(searchQuery) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const platformUsers = filteredCustomers.filter(customer => !customer.isGuest);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Select Customer
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>


        {/* Content */}
        <div className="overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading customers...</div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Platform Users */}
              {platformUsers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Platform Users ({platformUsers.length})
                  </h4>
                  <div className="space-y-2">
                    {platformUsers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.phone && `📞 ${customer.phone}`}
                          {customer.email && ` • ✉️ ${customer.email}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          Total: ₹{customer.totalAmount.toFixed(2)} • {customer.totalTransactions} transactions
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No customers found */}
              {filteredCustomers.length === 0 && !isLoading && (
                <div className="text-center text-gray-500 py-8">
                  {searchQuery ? 'No customers found matching your search.' : 'No customers registered yet.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-600 space-y-2">
          <button
            onClick={onAddNewCustomer}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add New Customer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerSelectionModal;
