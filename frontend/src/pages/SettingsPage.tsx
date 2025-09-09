import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/indexedDB';

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const { user, merchant, userType } = useAuth();
  const [language, setLanguage] = useState(i18n.language);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (userType === 'merchant' && merchant) {
      try {
        const settings = await db.getSettings(merchant.id);
        if (settings) {
          setLanguage(settings.language);
          setTheme(settings.theme);
          setNotifications(settings.notifications);
          setAutoSync(settings.autoSync);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    } else {
      // Load from localStorage for users
      const storedLang = localStorage.getItem('language');
      const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system';
      
      if (storedLang) setLanguage(storedLang);
      if (storedTheme) setTheme(storedTheme);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    i18n.changeLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    
    // Apply theme immediately
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    localStorage.setItem('theme', newTheme);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (userType === 'merchant' && merchant) {
        // Save to IndexedDB for merchants
        await db.saveSettings({
          merchantId: merchant.id,
          language,
          theme,
          notifications,
          autoSync,
        });
      } else {
        // Save to localStorage for users
        localStorage.setItem('language', language);
        localStorage.setItem('theme', theme);
        localStorage.setItem('notifications', notifications.toString());
      }
      
      alert(t('settings.save') + ' ✅');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = userType === 'merchant' ? (merchant?.business_name || merchant?.name) : user?.name;
  const displayEmail = userType === 'merchant' ? merchant?.email : user?.email;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-slate-600 text-white p-6">
            <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
            <p className="text-slate-200 mt-1">Manage your preferences and account settings</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Profile Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('settings.profile')}
              </h2>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-600 to-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">
                      {displayName?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{displayName}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{displayEmail}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                      {userType} Account
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Language Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('settings.language')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.selectLanguage')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      language === lang.code
                        ? 'border-slate-500 bg-slate-50 dark:bg-slate-800 dark:border-slate-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="text-2xl mb-2">{lang.flag}</div>
                    <div className="font-medium text-gray-900 dark:text-white">{lang.name}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Theme Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Theme
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', icon: '☀️' },
                  { value: 'dark', label: 'Dark', icon: '🌙' },
                  { value: 'system', label: 'System', icon: '💻' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value as any)}
                    className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                      theme === option.value
                        ? 'border-slate-500 bg-slate-50 dark:bg-slate-800 dark:border-slate-400'
                        : 'border-gray-200 dark:border-gray-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xl mb-1">{option.icon}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Notifications Section */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('settings.notifications')}
              </h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">Enable notifications</span>
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                    className="w-5 h-5 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                  />
                </label>
                
                {userType === 'merchant' && (
                  <label className="flex items-center justify-between">
                    <span className="text-gray-900 dark:text-white">Auto-sync data</span>
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="w-5 h-5 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
                    />
                  </label>
                )}
              </div>
            </section>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-slate-600 hover:bg-slate-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors duration-200 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : t('settings.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
