import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/indexedDB';
import { apiService } from '../services/api';
import CustomerSelectionModal from '../components/CustomerSelectionModal';
import AddPlatformUserModal from '../components/AddPlatformUserModal';
import CalculationHistory from '../components/CalculationHistory';
import GuestUserSalesModal from '../components/GuestUserSalesModal';

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

interface CalculationEntry {
  id: string;
  expression: string;
  result: number;
  timestamp: Date;
  isCorrect?: boolean;
}

const WorkingCalculatorPage = () => {
  const { merchant, token } = useAuth();
  const [display, setDisplay] = useState('0');
  const [calculationString, setCalculationString] = useState('');
  const [isNewCalculation, setIsNewCalculation] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAddPlatformUserModal, setShowAddPlatformUserModal] = useState(false);
  const [showGuestSalesModal, setShowGuestSalesModal] = useState(false);
  const [calculationHistory, setCalculationHistory] = useState<CalculationEntry[]>([]);
  // Load calculation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!merchant) return;
      try {
        const rows = await db.getCalculationHistory(merchant.id, 50);
        const mapped = rows.map(r => ({
          id: String(r.id!),
          expression: r.expression,
          result: r.result,
          timestamp: new Date(r.timestamp)
        }));
        setCalculationHistory(mapped);
      } catch (e) {
        console.error('Failed to load calculation history', e);
      }
    };
    loadHistory();
  }, [merchant]);
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [pendingPaymentType, setPendingPaymentType] = useState<'instant' | 'payLater' | null>(null);


  const handleNumberClick = (num: string) => {
    if (isNewCalculation) {
      setDisplay(num);
      setIsNewCalculation(false);
    } else {
      const newDisplay = display === '0' ? num : display + num;
      setDisplay(newDisplay);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setIsNewCalculation(true);
    setPreviousValue(null);
    setOperation(null);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      const newDisplay = display.slice(0, -1);
      setDisplay(newDisplay);
    } else {
      setDisplay('0');
      setIsNewCalculation(true);
    }
  };

  const handleDecimal = () => {
    if (!display.includes('.')) {
      const newDisplay = display + '.';
      setDisplay(newDisplay);
    }
  };

  const handleOperation = (op: string) => {
    if (previousValue === null) {
      setPreviousValue(parseFloat(display));
      setOperation(op);
      setCalculationString(`${display} ${op}`);
      setIsNewCalculation(true);
    } else if (operation) {
      const result = calculate();
      setDisplay(result.toString());
      setPreviousValue(result);
      setOperation(op);
      setCalculationString(`${previousValue} ${operation} ${display} = ${result} ${op}`);
      setIsNewCalculation(true);
    }
  };

  const calculate = (): number => {
    if (previousValue === null || !operation) return parseFloat(display);
    
    const currentValue = parseFloat(display);
    let result: number;

    switch (operation) {
      case '+':
        result = previousValue + currentValue;
        break;
      case '-':
        result = previousValue - currentValue;
        break;
      case '×':
        result = previousValue * currentValue;
        break;
      case '÷':
        result = currentValue !== 0 ? previousValue / currentValue : 0;
        break;
      default:
        result = currentValue;
    }

    return result;
  };

  const handleEquals = () => {
    if (previousValue !== null && operation) {
      const result = calculate();
      const expression = `${previousValue} ${operation} ${display} = ${result}`;
      setDisplay(result.toString());
      setCalculationString(expression);
      
      // Add to history
      const newEntry: CalculationEntry = {
        id: Date.now().toString(),
        expression,
        result,
        timestamp: new Date()
      };
      setCalculationHistory(prev => [newEntry, ...prev.slice(0, 49)]); // Keep last 50

      // Persist locally in IndexedDB (fire-and-forget)
      if (merchant) {
        db.addCalculationHistory({
          merchantId: merchant.id,
          expression,
          result,
          timestamp: new Date()
        }).catch(err => console.error('Failed to save calc history', err));
      }
      
      setPreviousValue(null);
      setOperation(null);
      setIsNewCalculation(true);
    }
  };

  const handlePayNow = () => {
    if (!merchant || !display || display === '0') {
      return;
    }
    setPendingPaymentType('instant');
    setShowCustomerModal(true);
  };

  const handlePayLater = () => {
    if (!merchant || !display || display === '0') {
      return;
    }
    setPendingPaymentType('payLater');
    setShowCustomerModal(true);
  };

  const handleGuestTransaction = async () => {
    if (!merchant || !display || display === '0' || !token) {
      return;
    }

    // Create guest customer object
    const guestCustomer: Customer = {
      merchantId: merchant.id,
      name: 'Guest Customer',
      totalTransactions: 0,
      totalAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'pending',
      isGuest: true
    };

    // Process guest transaction immediately
    await processTransaction(guestCustomer, 'instant');
  };


  const processTransaction = async (customer: Customer, paymentType: 'instant' | 'payLater') => {
    if (!merchant || !token) return;

    try {
      // Create transaction via backend API
      // Guest transactions can only be PAYED (immediate payment)
      const isGuestTransaction = customer.isGuest || false;
      const transactionType = isGuestTransaction ? 'payed' : (paymentType === 'instant' ? 'payed' : 'pending');
      
      const amount = parseFloat(display);
      if (!amount || isNaN(amount) || amount <= 0) {
        return;
      }

      // Determine if this should be a guest transaction
      // If customer doesn't have platformUserId, treat as guest transaction
      const shouldBeGuestTransaction = isGuestTransaction || !customer.platformUserId;
      
      const transactionData = {
        user_id: shouldBeGuestTransaction ? null : customer.platformUserId,
        amount: amount,
        type: shouldBeGuestTransaction ? 'payed' : transactionType, // Guest transactions are always 'payed'
        description: `${shouldBeGuestTransaction ? 'Guest' : (paymentType === 'instant' ? 'Pay Now' : 'Pay Later')} transaction of ${display}`,
        payment_method: paymentType === 'instant' ? 'cash' : 'online',
        is_guest_transaction: shouldBeGuestTransaction
      };

      // Validate transaction data before sending
      if (!transactionData.amount || transactionData.amount <= 0) {
        throw new Error('Invalid transaction amount');
      }
      if (!transactionData.type || !['payed', 'pending'].includes(transactionData.type)) {
        throw new Error('Invalid transaction type');
      }
      if (shouldBeGuestTransaction && transactionData.user_id !== null) {
        throw new Error('Guest transactions cannot have user_id');
      }
      if (!shouldBeGuestTransaction && (transactionData.user_id === null || transactionData.user_id === undefined)) {
        throw new Error('Regular transactions must have user_id');
      }

      console.log('Sending transaction data:', transactionData);
      const response = await apiService.createTransaction(token, transactionData);

      // Also store locally for offline access
      if (customer.id) {
        await db.updateCustomerTotals(customer.id, parseFloat(display));
      } else {
        // Create local customer record
        await db.addCustomer({
          merchantId: merchant.id,
          name: customer.name,
          phone: customer.phone || '',
          email: customer.email || '',
          totalTransactions: 1,
          totalAmount: parseFloat(display),
          isGuest: shouldBeGuestTransaction,
          platformUserId: customer.platformUserId
        });
      }

      // Add to calculation history
      const historyEntry: CalculationEntry = {
        id: Date.now().toString(),
        expression: calculationString || display,
        result: parseFloat(display),
        timestamp: new Date()
      };
      await db.addCalculationHistory({
        merchantId: merchant.id,
        expression: calculationString || display,
        result: parseFloat(display),
        timestamp: new Date()
      });
      setCalculationHistory(prev => [historyEntry, ...prev]);

      // Reset form
      setDisplay('0');
      setCalculationString('');
      setSelectedCustomer(customer);
      setIsNewCalculation(true);
      setPreviousValue(null);
      setOperation(null);
      setPendingPaymentType(null);
      setShowCustomerModal(false);

      const transactionTypeText = shouldBeGuestTransaction ? 'Guest transaction' : (paymentType === 'instant' ? 'Payment' : 'Pay Later transaction');
      // Success message removed
    } catch (error: any) {
      console.error('Error processing transaction:', error);
      console.error('Error details:', error?.message);
      // Error message removed
    }
  };

  const handleCustomerSelect = async (customer: Customer) => {
    if (!merchant || !pendingPaymentType || !token) return;
    
    // Process the transaction with the selected payment type
    await processTransaction(customer, pendingPaymentType);
  };

  const handleAddNewCustomer = () => {
    // Show the platform user modal
    setShowAddPlatformUserModal(true);
  };

  const handlePlatformUserAdded = async (user: {id:number; name:string; email:string; phone:string}) => {
    // Add the platform user to the local database and select them
    try {
      const added = await db.addCustomer({
        merchantId: merchant!.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        totalTransactions: 0,
        totalAmount: 0,
        isGuest: false,
        platformUserId: user.id,
      });

      // Select the user immediately
      handleCustomerSelect({
        merchantId: merchant!.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        totalTransactions: 0,
        totalAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
        isGuest: false,
        platformUserId: user.id,
        id: added.id,
      } as any);
    } catch (error) {
      console.error('Error adding platform user:', error);
      // Error adding user alert removed
    }
  };

  const handleCheckCalculation = (index: number) => {
    const entry = calculationHistory[index];
    const isCorrect = confirm(`Is this calculation correct?\n\n${entry.expression}`);
    
    setCalculationHistory(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, isCorrect } : item
      )
    );
  };

  const handleUseResult = (result: number) => {
    setDisplay(result.toString());
    setCalculationString('');
    setIsNewCalculation(true);
    setPreviousValue(null);
    setOperation(null);
    setShowHistoryModal(false);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Single Calculator Unit */}
      <div className="flex-1 p-4">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* History Section - Top of Calculator */}
          {calculationHistory.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Calculations</h3>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100 rounded hover:bg-purple-200 dark:hover:bg-purple-700 transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {calculationHistory.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="text-xs text-gray-600 dark:text-gray-400 font-mono cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded px-2 py-1" onClick={() => handleUseResult(entry.result)}>
                    {entry.expression} = ₹{entry.result.toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Display */}
          <div className="p-6 bg-gray-100 dark:bg-gray-700">
            {/* Calculation String */}
            {calculationString && (
              <div className="text-right text-sm font-mono text-gray-600 dark:text-gray-400 mb-2 min-h-[1.5rem]">
                {calculationString}
              </div>
            )}
            
            {/* Amount Display with Payment Status Color */}
            <div className={`text-right text-4xl font-mono min-h-[4rem] flex items-center justify-end ${
              pendingPaymentType === 'instant' 
                ? 'text-green-600 dark:text-green-400' 
                : pendingPaymentType === 'payLater' 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-900 dark:text-white'
            }`}>
              ₹{display}
            </div>
            
            {/* Selected Customer Info */}
            {selectedCustomer && (
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                Customer: {selectedCustomer.name}
                {selectedCustomer.isGuest && ' (Guest)'}
              </div>
            )}
          </div>

          {/* Payment Buttons */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                onClick={handlePayNow}
                disabled={!display || display === '0'}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              >
                💳 Pay Now
              </button>
              <button
                onClick={handlePayLater}
                disabled={!display || display === '0'}
                className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              >
                📝 Pay Later
              </button>
              <button
                onClick={handleGuestTransaction}
                disabled={!display || display === '0'}
                className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              >
                👤 Guest
              </button>
            </div>

          </div>

          {/* Calculator Buttons */}
          <div className="p-4">
          {/* First Row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <button
              onClick={handleClear}
              className="h-16 rounded-xl font-semibold text-xl bg-red-500 hover:bg-red-600 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              C
            </button>
            <button
              onClick={() => handleOperation('÷')}
              className="h-16 rounded-xl font-semibold text-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              ÷
            </button>
            <button
              onClick={handleBackspace}
              className="h-16 rounded-xl font-semibold text-xl bg-red-500 hover:bg-red-600 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              ⌫
            </button>
            <button
              onClick={() => handleOperation('×')}
              className="h-16 rounded-xl font-semibold text-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              ×
            </button>
          </div>

          {/* Second Row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <button
              onClick={() => handleNumberClick('7')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              7
            </button>
            <button
              onClick={() => handleNumberClick('8')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              8
            </button>
            <button
              onClick={() => handleNumberClick('9')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              9
            </button>
            <button
              onClick={() => handleOperation('-')}
              className="h-16 rounded-xl font-semibold text-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              -
            </button>
          </div>

          {/* Third Row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <button
              onClick={() => handleNumberClick('4')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              4
            </button>
            <button
              onClick={() => handleNumberClick('5')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              5
            </button>
            <button
              onClick={() => handleNumberClick('6')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              6
            </button>
            <button
              onClick={() => handleOperation('+')}
              className="h-16 rounded-xl font-semibold text-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              +
            </button>
          </div>

          {/* Fourth Row */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <button
              onClick={() => handleNumberClick('1')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              1
            </button>
            <button
              onClick={() => handleNumberClick('2')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              2
            </button>
            <button
              onClick={() => handleNumberClick('3')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              3
            </button>
            <button
              onClick={handleEquals}
              className="h-16 rounded-xl font-semibold text-xl bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 active:scale-95 shadow-lg row-span-2"
            >
              =
            </button>
          </div>

          {/* Fifth Row */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => handleNumberClick('0')}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg col-span-2"
            >
              0
            </button>
            <button
              onClick={handleDecimal}
              className="h-16 rounded-xl font-semibold text-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all duration-200 active:scale-95 shadow-lg"
            >
              .
            </button>
          </div>

          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <CustomerSelectionModal
        isVisible={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setPendingPaymentType(null);
        }}
        onSelectCustomer={handleCustomerSelect}
        onAddNewCustomer={handleAddNewCustomer}
        merchantId={merchant?.id || 0}
      />

      {/* Calculation History Modal */}
      <CalculationHistory
        isVisible={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={calculationHistory}
        onCheckCalculation={handleCheckCalculation}
        onUseResult={handleUseResult}
      />

      {/* Add Platform User Modal */}
      <AddPlatformUserModal
        isVisible={showAddPlatformUserModal}
        onClose={() => setShowAddPlatformUserModal(false)}
        onUserAdded={handlePlatformUserAdded}
        merchantId={merchant?.id || 0}
      />

      {/* Guest User Sales Modal */}
      <GuestUserSalesModal
        isVisible={showGuestSalesModal}
        onClose={() => setShowGuestSalesModal(false)}
        merchantId={merchant?.id || 0}
        token={token || ''}
      />
    </div>
  );
};

export default WorkingCalculatorPage;
