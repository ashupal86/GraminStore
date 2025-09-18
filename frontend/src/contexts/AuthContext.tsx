import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Merchant, UserType, AuthContextType, RegisterUserRequest, RegisterMerchantRequest } from '../types/auth';
import { apiService } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUserType = localStorage.getItem('userType') as UserType;
        
        if (storedToken && storedUserType) {
          setToken(storedToken);
          setUserType(storedUserType);
          
          // Fetch user profile
          if (storedUserType === 'user') {
            const userProfile = await apiService.getUserProfile(storedToken);
            setUser(userProfile);
          } else if (storedUserType === 'merchant') {
            const merchantProfile = await apiService.getMerchantProfile(storedToken);
            setMerchant(merchantProfile);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string, type: UserType) => {
    try {
      setIsLoading(true);
      
      const credentials = { email, password };
      let response;
      
      if (type === 'user') {
        response = await apiService.loginUser(credentials);
        // Fetch user profile after successful login
        const userProfile = await apiService.getUserProfile(response.access_token);
        setUser(userProfile);
        setMerchant(null);
      } else {
        response = await apiService.loginMerchant(credentials);
        // Fetch merchant profile after successful login
        const merchantProfile = await apiService.getMerchantProfile(response.access_token);
        setMerchant(merchantProfile);
        setUser(null);
      }
      
      setToken(response.access_token);
      setUserType(response.user_type as UserType);
      
      // Store in localStorage
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('userType', type);
      
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterUserRequest | RegisterMerchantRequest, type: UserType) => {
    try {
      setIsLoading(true);
      
      let response;
      
      if (type === 'user') {
        response = await apiService.registerUser(data as RegisterUserRequest);
        // Fetch user profile after successful registration
        const userProfile = await apiService.getUserProfile(response.access_token);
        setUser(userProfile);
        setMerchant(null);
      } else {
        response = await apiService.registerMerchant(data as RegisterMerchantRequest);
        // Fetch merchant profile after successful registration
        const merchantProfile = await apiService.getMerchantProfile(response.access_token);
        setMerchant(merchantProfile);
        setUser(null);
      }
      
      setToken(response.access_token);
      setUserType(response.user_type as UserType);
      
      // Store in localStorage
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('userType', response.user_type);
      
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setMerchant(null);
    setToken(null);
    setUserType(null);
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
  };

  const value: AuthContextType = {
    user,
    merchant,
    token,
    userType,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
