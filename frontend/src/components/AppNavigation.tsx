import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const AppNavigation = () => {
  const { t } = useTranslation();
  const { user, merchant, userType, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user && !merchant) {
    return null;
  }

  const merchantNavItems = [
    { key: 'calculator', path: '/dashboard/merchant', icon: '🧮', label: 'Calculator' },
    { key: 'analytics', path: '/analytics', icon: '📊', label: 'Dashboard' },
    { key: 'inventory', path: '/inventory', icon: '📦', label: 'Inventory' },
    { key: 'orders', path: '/orders', icon: '📋', label: 'Orders' },
    { key: 'settings', path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const userNavItems = [
    { key: 'dashboard', path: '/dashboard/user', icon: '🏠', label: 'Dashboard' },
    { key: 'marketplace', path: '/marketplace', icon: '🛒', label: 'Marketplace' },
    { key: 'settings', path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const navItems = userType === 'merchant' ? merchantNavItems : userNavItems;
  const displayName = userType === 'merchant' ? (merchant?.business_name || merchant?.name) : user?.name;

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={userType === 'merchant' ? '/calculator' : '/dashboard/user'} className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-gray-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GS</span>
            </div>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-300">GraminStore</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  location.pathname === item.path
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                    : 'text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label || t(`nav.${item.key}`)}</span>
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {displayName}
            </span>
            <button
              onClick={logout}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              {t('nav.signOut')}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 dark:text-gray-300 p-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    location.pathname === item.path
                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                      : 'text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label || t(`nav.${item.key}`)}</span>
                </Link>
              ))}
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  {displayName}
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors duration-200"
                >
                  {t('nav.signOut')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default AppNavigation;
