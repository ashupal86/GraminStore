import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/indexedDB';

const SimpleCalculatorPage = () => {
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const [display, setDisplay] = useState('0');
  const [isNewCalculation, setIsNewCalculation] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<'instant' | 'payLater'>('instant');

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const handleNumberClick = (num: string) => {
    if (isNewCalculation) {
      setDisplay(num);
      setIsNewCalculation(false);
    } else {
      const newDisplay = display === '0' ? num : display + num;
      setDisplay(newDisplay);
    }
  };

  const handleOperationClick = (operation: string) => {
    if (operation === 'clear') {
      setDisplay('0');
      setIsNewCalculation(true);
      return;
    }

    if (operation === 'backspace') {
      if (display.length > 1) {
        const newDisplay = display.slice(0, -1);
        setDisplay(newDisplay);
      } else {
        setDisplay('0');
        setIsNewCalculation(true);
      }
      return;
    }

    if (operation === '.') {
      if (!display.includes('.')) {
        const newDisplay = display + '.';
        setDisplay(newDisplay);
      }
      return;
    }
  };

  const handleTransactionSubmit = async () => {
    if (!merchant || !display || !customerName) {
      return;
    }

    try {
      await db.addTransaction({
        merchantId: merchant.id,
        customerName,
        customerPhone: customerPhone || undefined,
        amount: parseFloat(display),
        description: description || `Transaction of ₹${display}`,
        paymentType,
        status: paymentType === 'instant' ? 'completed' : 'pending',
      });

      // Reset form
      setDisplay('0');
      setCustomerName('');
      setCustomerPhone('');
      setDescription('');
      setIsNewCalculation(true);

      // Success: no alert shown
    } catch (error) {
      console.error('Error adding transaction:', error);
      // Error: no alert shown
    }
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
      {/* Status Bar */}
      <div className="max-w-md mx-auto mb-4">
        <div className={`px-4 py-2 rounded-xl text-sm font-medium text-center ${
          isOnline 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        }`}>
          {isOnline ? '🟢 Online Mode' : '🟡 Offline Mode'}
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <h1 className="text-2xl font-bold text-center">GraminStore Calculator</h1>
          <p className="text-center text-blue-100 mt-1">Smart POS for Merchants</p>
        </div>

        {/* Display */}
        <div className="p-6 bg-gray-100 dark:bg-gray-700">
          <div className="text-right text-4xl font-mono text-gray-900 dark:text-white min-h-[4rem] flex items-center justify-end">
            ₹{display}
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-600 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Transaction description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Type
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setPaymentType('instant')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  paymentType === 'instant'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                💳 Pay Now
              </button>
              <button
                onClick={() => setPaymentType('payLater')}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  paymentType === 'payLater'
                    ? 'bg-yellow-600 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                📝 Pay Later
              </button>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="p-4">
          <div className="space-y-3">
            {calculatorButtons.map((buttonRow, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-3">
                {buttonRow.map((btn, btnIndex) => {
                  if (!btn) return <div key={`${rowIndex}-${btnIndex}`}></div>;
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
              disabled={!display || !customerName}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-4 rounded-xl font-bold text-lg transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
            >
              {paymentType === 'instant' ? '💳 Process Payment' : '📝 Record Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleCalculatorPage;
