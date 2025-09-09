import { useTranslation } from 'react-i18next';

const MarketplacePage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {t('nav.marketplace')}
          </h1>
          
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Discover Local Merchants
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Find nearby merchants and businesses to transact with.
            </p>
            <button className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200">
              {t('dashboard.findMerchants')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplacePage;
