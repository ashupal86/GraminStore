import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import UserDashboard from './pages/dashboards/UserDashboard';
import MerchantDashboard from './pages/dashboards/MerchantDashboard';
import EnhancedMerchantDashboard from './pages/dashboards/EnhancedMerchantDashboard';
import WorkingCalculatorPage from './pages/WorkingCalculatorPage';
import OrdersPage from './pages/OrdersPage';
import UserOrdersPage from './pages/UserOrdersPage';
import MarketplacePage from './pages/MarketplacePage';
import SettingsPage from './pages/SettingsPage';
import InventoryPage from './pages/InventoryPage';
import Navbar from './components/Navbar';
import AppNavigation from './components/AppNavigation';
import ProtectedRoute from './components/ProtectedRoute';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, merchant } = useAuth();
  const isLoggedIn = !!(user || merchant);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          <>
            <Navbar />
            <LandingPage />
          </>
        } />
        
        {/* Authentication routes */}
        <Route path="/auth/:type/login" element={<LoginPage />} />
        <Route path="/auth/:type/register" element={<RegisterPage />} />
        
        {/* Protected routes with app navigation */}
        <Route path="/dashboard/user" element={
          <ProtectedRoute requireUserType="user">
            <AppNavigation />
            <UserDashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/merchant" element={
          <ProtectedRoute requireUserType="merchant">
            <AppNavigation />
            <WorkingCalculatorPage />
          </ProtectedRoute>
        } />
        <Route path="/calculator" element={
          <ProtectedRoute requireUserType="merchant">
            <AppNavigation />
            <WorkingCalculatorPage />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute requireUserType="merchant">
            <AppNavigation />
            <EnhancedMerchantDashboard />
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute requireUserType="merchant">
            <AppNavigation />
            <InventoryPage />
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute requireUserType="merchant">
            <AppNavigation />
            <OrdersPage />
          </ProtectedRoute>
        } />
        <Route path="/my-orders" element={
          <ProtectedRoute requireUserType="user">
            <AppNavigation />
            <UserOrdersPage />
          </ProtectedRoute>
        } />
        <Route path="/marketplace" element={
          <ProtectedRoute requireUserType="user">
            <AppNavigation />
            <MarketplacePage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <AppNavigation />
            <SettingsPage />
          </ProtectedRoute>
        } />
        
        {/* Fallback route */}
        <Route path="*" element={
          <>
            <Navbar />
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
                <p className="text-gray-600 dark:text-gray-400">Page not found</p>
              </div>
            </div>
          </>
        } />
      </Routes>
      
      {/* PWA Install Prompt - only for logged-in users */}
      {isLoggedIn && <PWAInstallPrompt />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
