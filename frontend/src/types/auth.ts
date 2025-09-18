// User and Merchant types (matching backend schemas)
export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  created_at: string;
}

export interface Merchant {
  id: number;
  name: string;
  email: string;
  phone: string;
  aadhar_number: string;
  business_name?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  business_type?: string;
  user_type: string;
  created_at: string;
}

// Authentication response types (matching backend Token schema)
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_type: string;
  user_id: number;
  expires_in: number;
}

// Request types for forms
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterUserRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterMerchantRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  aadhar_number: string;
  business_name?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  business_type?: string;
}

// Form validation types
export interface FormErrors {
  [key: string]: string;
}

// User type enum
export type UserType = 'user' | 'merchant';

// Auth context types
export interface AuthContextType {
  user: User | null;
  merchant: Merchant | null;
  token: string | null;
  userType: UserType | null;
  isLoading: boolean;
  login: (email: string, password: string, type: UserType) => Promise<void>;
  register: (data: RegisterUserRequest | RegisterMerchantRequest, type: UserType) => Promise<void>;
  logout: () => void;
}
