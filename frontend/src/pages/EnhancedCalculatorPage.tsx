import { useState, useEffect } from 'react';
// import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/indexedDB';
// import { apiService } from '../services/api';
import { useSync } from '../hooks/useSync';
import TransactionHistory from '../components/TransactionHistory';

// Types
interface PlatformUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  user_type: 'user' | 'merchant';
}

interface GuestUser {
  id?: number;
  name: string;
  phone: string;
  isGuest: true;
}

interface TransactionData {
  amount: number;
  customer: PlatformUser | GuestUser | null;
  description: string;
  paymentType: 'instant' | 'payLater';
  status: 'pending' | 'completed' | 'cancelled';
}

const EnhancedCalculatorPage = () => {
  // const { t } = useTranslation();
  const { merchant } = useAuth();
  const { syncStatus, performSync, forceSync } = useSync(merchant?.id);
  const [display, setDisplay] = useState('0');
  const [isNewCalculation, setIsNewCalculation] = useState(true);
  const [showUserSelection, setShowUserSelection] = useState(false);
  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<PlatformUser | GuestUser | null>(null);
  const [transactionData, setTransactionData] = useState<TransactionData>({
    amount: 0,
    customer: null,
    description: '',
    paymentType: 'instant',
    status: 'pending'
  });
  const [pendingAmount, setPendingAmount] = useState(0);
  // const [paidAmount, setPaidAmount] = useState(0);
  const [balance, setBalance] = useState(0);
  // const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  // PWA Install Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPWAInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (syncStatus.isOnline && !syncStatus.isSyncing && merchant?.id) {
      performSync();
    }
  }, [syncStatus.isOnline, merchant?.id]);

  // Load platform users when merchant logs in
  useEffect(() => {
    if (merchant && syncStatus.isOnline) {
      loadPlatformUsers();
    }
  }, [merchant, syncStatus.isOnline]);

  // Load pending amounts for selected user
  useEffect(() => {
    if (selectedUser && 'isGuest' in selectedUser && !selectedUser.isGuest) {
      loadUserPendingAmount(selectedUser.id!);
    } else {
      setPendingAmount(0);
      // setPaidAmount(0);
      setBalance(0);
    }
  }, [selectedUser]);

  const loadPlatformUsers = async () => {
    try {
      // This would be an API call to get users associated with this merchant
      // For now, we'll use mock data
      const mockUsers: PlatformUser[] = [
        { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+91 9876543210', user_type: 'user' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '+91 9876543211', user_type: 'user' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', phone: '+91 9876543212', user_type: 'user' },
      ];
      setPlatformUsers(mockUsers);
    } catch (error) {
      console.error('Error loading platform users:', error);
    }
  };

  const loadUserPendingAmount = async (_userId: number) => {
    try {
      // Load pending transactions for this user from IndexedDB
      const transactions = await db.getTransactions(merchant!.id);
      const userTransactions = transactions.filter(t => 
        t.customerPhone && selectedUser && 'phone' in selectedUser && 
        t.customerPhone === selectedUser.phone
      );
      
      const pending = userTransactions
        .filter(t => t.status === 'pending' && t.paymentType === 'payLater')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const paid = userTransactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      setPendingAmount(pending);
      // setPaidAmount(paid);
      setBalance(paid - pending);
    } catch (error) {
      console.error('Error loading user pending amount:', error);
    }
  };

  const handleNumberClick = (num: string) => {
    if (isNewCalculation) {
      setDisplay(num);
      setTransactionData(prev => ({ ...prev, amount: parseFloat(num) }));
      setIsNewCalculation(false);
    } else {
      const newDisplay = display === '0' ? num : display + num;
      setDisplay(newDisplay);
      setTransactionData(prev => ({ ...prev, amount: parseFloat(newDisplay) }));
    }
  };

  const handleOperationClick = (operation: string) => {
    if (operation === 'clear') {
      setDisplay('0');
      setTransactionData(prev => ({ ...prev, amount: 0 }));
      setIsNewCalculation(true);
      return;
    }

    if (operation === 'backspace') {
      if (display.length > 1) {
        const newDisplay = display.slice(0, -1);
        setDisplay(newDisplay);
        setTransactionData(prev => ({ ...prev, amount: parseFloat(newDisplay) || 0 }));
      } else {
        setDisplay('0');
        setTransactionData(prev => ({ ...prev, amount: 0 }));
        setIsNewCalculation(true);
      }
      return;
    }

    if (operation === '.') {
      if (!display.includes('.')) {
        const newDisplay = display + '.';
        setDisplay(newDisplay);
        setTransactionData(prev => ({ ...prev, amount: parseFloat(newDisplay) }));
      }
      return;
    }
  };

  const handlePaymentTypeChange = (type: 'instant' | 'payLater') => {
    setTransactionData(prev => ({ ...prev, paymentType: type }));
    if (type === 'payLater' || type === 'instant') {
      setShowUserSelection(true);
    }
  };

  const handleUserSelect = (user: PlatformUser | GuestUser | null) => {
    setSelectedUser(user);
    setTransactionData(prev => ({ ...prev, customer: user }));
    setShowUserSelection(false);
  };

  const handleCreateGuestUser = () => {
    const guestUser: GuestUser = {
      name: `Guest ${Date.now()}`,
      phone: '',
      isGuest: true
    };
    handleUserSelect(guestUser);
  };

  const handleMobileLookup = async (phone: string) => {
    if (!phone || phone.length < 10) return;
    
    const user = platformUsers.find(u => u.phone.includes(phone) || phone.includes(u.phone));
    if (user) {
      handleUserSelect(user);
    }
  };

  const handleTransactionSubmit = async () => {
    if (!merchant || !transactionData.amount || !transactionData.customer) {
      return;
    }

    try {
      const transaction = {
        merchantId: merchant.id,
        customerName: transactionData.customer.name,
        customerPhone: 'phone' in transactionData.customer ? transactionData.customer.phone : undefined,
        amount: transactionData.amount,
        description: transactionData.description || `Transaction of ₹${transactionData.amount}`,
        paymentType: transactionData.paymentType,
        status: transactionData.paymentType === 'instant' ? 'completed' : 'pending' as const,
      };

      await db.addTransaction({
        ...transaction,
        status: transaction.status as 'pending' | 'completed' | 'cancelled'
      });

      // Reset form
      setDisplay('0');
      setTransactionData({
        amount: 0,
        customer: null,
        description: '',
        paymentType: 'instant',
        status: 'pending'
      });
      setSelectedUser(null);
      setIsNewCalculation(true);

      // Success: no alert shown
    } catch (error) {
      console.error('Error adding transaction:', error);
      // Error: no alert shown
    }
  };

  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowPWAInstall(false);
    }
  };

  const getBalanceColor = () => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBalanceText = () => {
    if (balance > 0) return `+₹${balance.toFixed(2)} (Credit)`;
    if (balance < 0) return `-₹${Math.abs(balance).toFixed(2)} (Later)`;
    return '₹0.00 (Balanced)';
  };

  const calculatorButtons = [
    ['clear', '/', 'backspace', '*'],
    ['7', '8', '9', '-'],
    ['4', '5', '6', '+'],
    ['1', '2', '3', '='],
    ['0', '.', '', '='],
  ];

  const getButtonContent = (btn: string) => {
    switch (btn) {
      case 'clear': return 'C';
      case 'backspace': return '⌫';
      case '*': return '×';
      case '/': return '÷';
      default: return btn;
    }
  };

  const getButtonClass = (btn: string) => {
    const baseClass = 'h-16 rounded-xl font-semibold text-xl transition-all duration-200 active:scale-95 shadow-lg ';
    
    if (['clear', 'backspace'].includes(btn)) {
      return baseClass + 'bg-red-500 hover:bg-red-600 text-white';
    }
    if (['+', '-', '*', '/', '='].includes(btn)) {
      return baseClass + 'bg-blue-600 hover:bg-blue-700 text-white';
    }
    if (btn === '0') {
      return baseClass + 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white col-span-2';
    }
    return baseClass + 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      {/* PWA Install Prompt */}
      {showPWAInstall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Install GraminStore</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Install this app for a better offline experience and quick access to your calculator.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPWAInstall(false)}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Not Now
                </button>
                <button
                  onClick={handlePWAInstall}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Selection Modal */}
      {showUserSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md mx-4 shadow-2xl max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select Customer</h3>
              <button
                onClick={() => setShowUserSelection(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Mobile Number Lookup */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Search by Mobile
              </label>
              <input
                type="tel"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleMobileLookup(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter mobile number"
              />
            </div>

            {/* Platform Users List */}
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {platformUsers
                .filter(user => 
                  user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  user.phone.includes(searchQuery) ||
                  user.email.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{user.phone}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">{user.email}</div>
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Platform User
                      </div>
                    </div>
                  </button>
                ))}
              
              {platformUsers.filter(user => 
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.phone.includes(searchQuery) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && searchQuery && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No users found matching "{searchQuery}"
                </div>
              )}
            </div>

            {/* Guest User Option */}
            <button
              onClick={handleCreateGuestUser}
              className="w-full p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <div className="font-medium">+ Create Guest User</div>
              <div className="text-sm">One-time transaction</div>
            </button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="max-w-md mx-auto mb-4 space-y-2">
        <div className={`px-4 py-2 rounded-xl text-sm font-medium text-center ${
          syncStatus.isOnline 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        }`}>
          {syncStatus.isOnline ? '🟢 Online Mode' : '🟡 Offline Mode'}
          {syncStatus.pendingItems > 0 && (
            <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
              {syncStatus.pendingItems} pending sync
            </span>
          )}
        </div>
        
        {syncStatus.isSyncing && (
          <div className="px-4 py-2 rounded-xl text-sm font-medium text-center bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            🔄 Syncing data...
          </div>
        )}
        
        {syncStatus.syncError && (
          <div className="px-4 py-2 rounded-xl text-sm font-medium text-center bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            ❌ Sync failed: {syncStatus.syncError}
            <button 
              onClick={() => forceSync()}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">GraminStore Calculator</h1>
              <p className="text-blue-100 text-sm">Smart POS for Merchants</p>
            </div>
            <button
              onClick={() => forceSync()}
              disabled={!syncStatus.isOnline || syncStatus.isSyncing}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Sync data"
            >
              {syncStatus.isSyncing ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Customer Info Display */}
        {selectedUser && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {selectedUser.name}
                  {'isGuest' in selectedUser && selectedUser.isGuest && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full ml-2">Guest</span>}
                </div>
                {'phone' in selectedUser && selectedUser.phone && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">{selectedUser.phone}</div>
                )}
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${getBalanceColor()}`}>
                  {getBalanceText()}
                </div>
                {pendingAmount > 0 && (
                  <div className="text-xs text-red-600">Later: ₹{pendingAmount.toFixed(2)}</div>
                )}
                {'phone' in selectedUser && selectedUser.phone && (
                  <button
                    onClick={() => setShowTransactionHistory(true)}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    View History
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Display */}
        <div className="p-6 bg-gray-100 dark:bg-gray-700">
          <div className="text-right text-4xl font-mono text-gray-900 dark:text-white min-h-[4rem] flex items-center justify-end">
            ₹{display}
          </div>
        </div>

        {/* Description Field */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={transactionData.description}
            onChange={(e) => setTransactionData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter transaction description"
          />
        </div>

        {/* Payment Type Selection */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="flex space-x-2">
            <button
              onClick={() => handlePaymentTypeChange('instant')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                transactionData.paymentType === 'instant'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              💳 Pay Now
            </button>
            <button
              onClick={() => handlePaymentTypeChange('payLater')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                transactionData.paymentType === 'payLater'
                  ? 'bg-yellow-600 text-white shadow-lg'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              📝 Pay Later
            </button>
          </div>
        </div>

        {/* Calculator */}
        <div className="p-4">
          <div className="space-y-3">
            {calculatorButtons.map((buttonRow, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-3">
                {buttonRow.map((btn, btnIndex) => {
                  if (!btn) return <div key={`${rowIndex}-${btnIndex}`}></div>; // Empty space
                  return (
                    <button
                      key={`${rowIndex}-${btnIndex}`}
                      onClick={() => {
                        if (btn === '=') {
                          setIsNewCalculation(true);
                        } else {
                          if (['+', '-', '*', '/'].includes(btn)) {
                            return;
                          }
                          if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].includes(btn)) {
                            handleNumberClick(btn);
                          } else {
                            handleOperationClick(btn);
                          }
                        }
                      }}
                      className={getButtonClass(btn)}
                    >
                      {getButtonContent(btn)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3">
            <button
              onClick={handleTransactionSubmit}
              disabled={!transactionData.amount || !transactionData.customer}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-4 rounded-xl font-bold text-lg transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
            >
              {transactionData.paymentType === 'instant' ? '💳 Process Payment' : '📝 Record Transaction'}
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Modal */}
      {selectedUser && 'phone' in selectedUser && selectedUser.phone && (
        <TransactionHistory
          merchantId={merchant!.id}
          userPhone={selectedUser.phone}
          isVisible={showTransactionHistory}
          onClose={() => setShowTransactionHistory(false)}
        />
      )}
    </div>
  );
};

export default EnhancedCalculatorPage;
