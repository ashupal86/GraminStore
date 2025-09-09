import type { AuthResponse, LoginRequest, RegisterUserRequest, RegisterMerchantRequest, User, Merchant } from '../types/auth';

const API_BASE_URL = 'http://localhost:8009'; // Adjust this to match your backend URL

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  // Authentication endpoints
  async loginUser(credentials: LoginRequest): Promise<AuthResponse> {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    return this.request<AuthResponse>('/auth/users/login', {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData,
    });
  }

  async loginMerchant(credentials: LoginRequest): Promise<AuthResponse> {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);

    return this.request<AuthResponse>('/auth/merchants/login', {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData,
    });
  }

  async registerUser(userData: RegisterUserRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/users/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async registerMerchant(merchantData: RegisterMerchantRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/merchants/register', {
      method: 'POST',
      body: JSON.stringify(merchantData),
    });
  }

  // Profile endpoints
  async getUserProfile(token: string): Promise<User> {
    return this.request<User>('/users/me', {
      headers: this.getAuthHeaders(token),
    });
  }

  async getMerchantProfile(token: string): Promise<Merchant> {
    return this.request<Merchant>('/merchants/me', {
      headers: this.getAuthHeaders(token),
    });
  }

  // Update profile endpoints
  async updateUserProfile(token: string, userData: Partial<User>): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(userData),
    });
  }

  async updateMerchantProfile(token: string, merchantData: Partial<Merchant>): Promise<Merchant> {
    return this.request<Merchant>('/merchants/me', {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(merchantData),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
