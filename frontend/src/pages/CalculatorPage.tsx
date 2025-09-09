import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/indexedDB';

const CalculatorPage = () => {
  const { t } = useTranslation();
  const { merchant } = useAuth();
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<'instant' | 'payLater'>('instant');
  const [display, setDisplay] = useState('0');
  const [isNewCalculation, setIsNewCalculation] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
      setAmount(num);
      setIsNewCalculation(false);
    } else {
      const newDisplay = display === '0' ? num : display + num;
      setDisplay(newDisplay);
      setAmount(newDisplay);
    }
  };

  const handleOperationClick = (operation: string) => {
    if (operation === 'clear') {
      setDisplay('0');
      setAmount('');
      setIsNewCalculation(true);
      return;
    }

    if (operation === 'backspace') {
      if (display.length > 1) {
        const newDisplay = display.slice(0, -1);
        setDisplay(newDisplay);
        setAmount(newDisplay);
      } else {
        setDisplay('0');
        setAmount('');
        setIsNewCalculation(true);
      }
      return;
    }

    if (operation === '.') {
      if (!display.includes('.')) {
        const newDisplay = display + '.';
        setDisplay(newDisplay);
        setAmount(newDisplay);
      }
      return;
    }
  };

  const handleAddTransaction = async () => {
    if (!merchant || !amount || !customerName) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await db.addTransaction({
        merchantId: merchant.id,
        customerName,
        customerPhone: customerPhone || undefined,
        amount: parseFloat(amount),
        description: description || `Transaction of ₹${amount}`,
        paymentType,
        status: paymentType === 'instant' ? 'completed' : 'pending',
      });

      // Reset form
      setAmount('');
      setCustomerName('');
      setCustomerPhone('');
      setDescription('');
      setDisplay('0');
      setIsNewCalculation(true);

      alert(
        paymentType === 'instant'
          ? `Transaction of ₹${amount} completed successfully!`
          : `Pay later transaction of ₹${amount} recorded!`
      );
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Error saving transaction. Please try again.');
    }
  };

  const calculatorButtons = [
    ['clear', '/', 'backspace'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '='],
  ];

  const getButtonContent = (btn: string) => {
    switch (btn) {
      case 'clear':
        return 'C';
      case 'backspace':
        return '⌫';
      case '*':
        return '×';
      case '/':
        return '÷';
      default:
        return btn;
    }
  };

  const getButtonClass = (btn: string) => {
    const baseClass = 'h-14 rounded-lg font-semibold text-lg transition-all duration-200 active:scale-95 ';
    
    if (['clear', 'backspace'].includes(btn)) {
      return baseClass + 'bg-red-500 hover:bg-red-600 text-white';
    }
    if (['+', '-', '*', '/', '='].includes(btn)) {
      return baseClass + 'bg-slate-600 hover:bg-slate-700 text-white';
    }
    if (btn === '0') {
      return baseClass + 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white col-span-2';
    }
    return baseClass + 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      {/* Status Bar */}
      <div className="max-w-md mx-auto mb-4">
        <div className={`px-3 py-2 rounded-lg text-sm font-medium text-center ${
          isOnline 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        }`}>
          {isOnline ? t('pwa.onlineMode') : t('pwa.offlineMode')}
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-600 text-white p-4">
          <h1 className="text-xl font-bold text-center">{t('calculator.title')}</h1>
        </div>

        {/* Display */}
        <div className="p-4 bg-gray-100 dark:bg-gray-700">
          <div className="text-right text-3xl font-mono text-gray-900 dark:text-white min-h-[3rem] flex items-center justify-end">
            ₹{display}
          </div>
        </div>

        {/* Customer Info */}
        <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-600">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator.customerName')} *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator.customerPhone')}
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('calculator.description')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Transaction description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('calculator.paymentType')}
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setPaymentType('instant')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
                  paymentType === 'instant'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('calculator.instant')}
              </button>
              <button
                onClick={() => setPaymentType('payLater')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200 ${
                  paymentType === 'payLater'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('calculator.payLater')}
              </button>
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {calculatorButtons.flat().map((btn, index) => (
              <button
                key={index}
                onClick={() => {
                  if (btn === '=') {
                    // For now, just set the amount
                    setIsNewCalculation(true);
                  } else {
                    if (['+', '-', '*', '/'].includes(btn)) {
                      // Basic operations - for now just handle as numbers
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
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleAddTransaction}
              disabled={!amount || !customerName}
              className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold text-lg transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {t('calculator.addTransaction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorPage;
