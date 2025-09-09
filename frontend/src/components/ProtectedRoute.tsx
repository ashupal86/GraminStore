import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserType } from '../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireUserType?: UserType;
}

const ProtectedRoute = ({ children, requireUserType }: ProtectedRouteProps) => {
  const { user, merchant, userType, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  // Check if user is authenticated
  const isAuthenticated = user || merchant;

  if (!isAuthenticated) {
    // Redirect to appropriate login page
    const loginPath = requireUserType ? `/auth/${requireUserType}/login` : '/auth/user/login';
    return <Navigate to={loginPath} replace />;
  }

  // Check if user type matches requirement
  if (requireUserType && userType !== requireUserType) {
    // Redirect to appropriate dashboard if user is logged in but wrong type
    const dashboardPath = userType === 'merchant' ? '/dashboard/merchant' : '/dashboard/user';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
