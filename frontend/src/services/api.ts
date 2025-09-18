import type { AuthResponse, LoginRequest, RegisterUserRequest, RegisterMerchantRequest, User, Merchant } from '../types/auth';

// const API_BASE_URL = 'https://graminstore-backend-53e13181bd39.herokuapp.com'; // Hosted backend URL
const API_BASE_URL = 'http://192.168.1.10:8009';
class ApiService {
  private _baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this._baseURL = baseURL;
  }

  get baseURL() {
    return this._baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this._baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    console.log('API Request:', {
      url,
      method: config.method || 'GET',
      headers: config.headers,
      body: config.body
    });

    // Log the parsed body for debugging
    if (config.body && typeof config.body === 'string') {
      try {
        const parsedBody = JSON.parse(config.body);
        console.log('Parsed request body:', parsedBody);
      } catch (e) {
        console.log('Could not parse request body:', config.body);
      }
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error Response:', errorData);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Handle validation errors specifically
      if (response.status === 422) {
        const errorMessage = Array.isArray(errorData.detail) 
          ? errorData.detail.map((err: any) => `${err.loc?.join('.')}: ${err.msg}`).join(', ')
          : errorData.detail || 'Validation error';
        throw new Error(`Validation error: ${errorMessage}`);
      }
      
      throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Convenience helpers returning Axios-like { data }
  async get<T = any>(endpoint: string, token?: string): Promise<{ data: T }> {
    const options: RequestInit = token ? { headers: this.getAuthHeaders(token) } : {};
    const data = await this.request<T>(endpoint, { method: 'GET', ...options });
    return { data };
  }

  async post<T = any>(endpoint: string, body?: any, token?: string): Promise<{ data: T }> {
    const options: RequestInit = {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: token ? this.getAuthHeaders(token) : { 'Content-Type': 'application/json' },
    };
    const data = await this.request<T>(endpoint, options);
    return { data };
  }

  private getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Authentication endpoints
  async loginUser(credentials: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/login/user', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async loginMerchant(credentials: LoginRequest): Promise<AuthResponse> {
    console.log('Sending merchant login request:', credentials);
    return this.request<AuthResponse>('/api/v1/auth/login/merchant', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async registerUser(userData: RegisterUserRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register/user', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async registerMerchant(merchantData: RegisterMerchantRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register/merchant', {
      method: 'POST',
      body: JSON.stringify(merchantData),
    });
  }

  // Profile endpoints
  async getUserProfile(token: string): Promise<User> {
    return this.request<User>('/api/v1/auth/profile/user', {
      headers: this.getAuthHeaders(token),
    });
  }

  async getMerchantProfile(token: string): Promise<Merchant> {
    return this.request<Merchant>('/api/v1/auth/profile/merchant', {
      headers: this.getAuthHeaders(token),
    });
  }

  // Update profile endpoints
  async updateUserProfile(token: string, userData: Partial<User>): Promise<User> {
    return this.request<User>('/api/v1/auth/profile/user', {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(userData),
    });
  }

  async updateMerchantProfile(token: string, merchantData: Partial<Merchant>): Promise<Merchant> {
    return this.request<Merchant>('/api/v1/auth/profile/merchant', {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(merchantData),
    });
  }

  // Transaction endpoints
  async createTransaction(token: string, transactionData: any): Promise<any> {
    return this.request<any>('/api/v1/transactions/create', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(transactionData),
    });
  }

  async getTransactionHistory(token: string, limit: number = 10, offset: number = 0, days: number = 30): Promise<any[]> {
    return this.request<any[]>(`/api/v1/transactions/history?limit=${limit}&offset=${offset}&days=${days}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getTransactionAnalytics(token: string, days: number = 30): Promise<any> {
    return this.request<any>(`/api/v1/transactions/analytics?days=${days}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  // Dashboard endpoints
  async getMerchantDashboard(token: string, days: number = 30): Promise<any> {
    return this.request<any>(`/api/v1/dashboard/merchant?days=${days}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getUserDashboard(token: string): Promise<any> {
    return this.request<any>('/api/v1/dashboard/user', {
      headers: this.getAuthHeaders(token),
    });
  }

  async getTopCustomers(token: string, limit: number = 10): Promise<any[]> {
    return this.request<any[]>(`/api/v1/dashboard/merchant/top-customers?limit=${limit}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getUserExpenseBreakdown(token: string): Promise<any[]> {
    return this.request<any[]>('/api/v1/dashboard/user/expenses', {
      headers: this.getAuthHeaders(token),
    });
  }

  async getDetailedAnalytics(token: string, period: string = 'monthly'): Promise<any> {
    return this.request<any>(`/api/v1/dashboard/merchant/analytics/detailed?period=${period}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  // WebSocket connection for real-time updates
  createWebSocketConnection(token: string): WebSocket {
    const wsUrl = this._baseURL.replace('https://', 'wss://').replace('http://', 'ws://');
    return new WebSocket(`${wsUrl}/api/v1/ws/transaction-history/${token}`);
  }

  // Lookup platform user by phone
  async lookupUserByPhone(phone: string): Promise<{id:number; name:string; email:string; phone:string}> {
    return this.request(`/api/v1/auth/lookup/user-by-phone?phone=${encodeURIComponent(phone)}`);
  }

  // Search platform users by partial phone number
  async searchUsersByPhone(phone: string, limit: number = 10): Promise<{id:number; name:string; email:string; phone:string}[]> {
    return this.request(`/api/v1/auth/search/users-by-phone?phone=${encodeURIComponent(phone)}&limit=${limit}`);
  }

  // Get guest users with their transaction details
  async getGuestUsers(token: string): Promise<any[]> {
    return this.request<any[]>(`/api/v1/transactions/guest-users`, {
      headers: this.getAuthHeaders(token),
    });
  }

  // FakeStore API endpoints for marketplace
  async getFakeStoreCategories(): Promise<string[]> {
    const response = await fetch('https://fakestoreapi.com/products/categories');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getFakeStoreProducts(limit: number = 20, page: number = 1): Promise<any[]> {
    const response = await fetch(`https://fakestoreapi.com/products?limit=${limit}&page=${page}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getFakeStoreProductsByCategory(category: string, limit: number = 20, page: number = 1): Promise<any[]> {
    const response = await fetch(`https://fakestoreapi.com/products/category/${category}?limit=${limit}&page=${page}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async getFakeStoreProduct(id: number): Promise<any> {
    const response = await fetch(`https://fakestoreapi.com/products/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // Open Food Facts (free) - public product catalog
  async offLookupBarcode(barcode: string): Promise<any | null> {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.product) return data.product;
    return null;
  }

  async offSearchProducts(query: string, page: number = 1, pageSize: number = 20): Promise<any[]> {
    const params = new URLSearchParams({
      search_terms: query,
      page: String(page),
      page_size: String(pageSize),
      json: '1'
    });
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  }

  // Marketplace endpoints
  async getMerchantsWithInventory(): Promise<any[]> {
    return this.request<any[]>('/api/v1/marketplace/merchants');
  }

  async searchItemsAcrossMerchants(
    query: string, 
    category?: string, 
    limit: number = 50, 
    skip: number = 0
  ): Promise<any[]> {
    const params = new URLSearchParams({
      query,
      limit: String(limit),
      skip: String(skip)
    });
    if (category) params.append('category', category);
    
    return this.request<any[]>(`/api/v1/marketplace/search?${params.toString()}`);
  }

  async getAllCategories(): Promise<string[]> {
    return this.request<string[]>('/api/v1/marketplace/categories');
  }

  async getMerchantItems(
    merchantId: number, 
    category?: string, 
    search?: string, 
    limit: number = 50, 
    skip: number = 0
  ): Promise<any[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      skip: String(skip)
    });
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    
    return this.request<any[]>(`/api/v1/marketplace/merchant/${merchantId}/items?${params.toString()}`);
  }

  async getMerchantCategories(merchantId: number): Promise<string[]> {
    return this.request<string[]>(`/api/v1/marketplace/merchant/${merchantId}/categories`);
  }

  async getMarketplaceStats(): Promise<any> {
    return this.request<any>('/api/v1/marketplace/stats');
  }

  // Enhanced User Dashboard endpoints
  async getUserMerchantsWithPending(token: string): Promise<any[]> {
    return this.request<any[]>(`/api/v1/dashboard/user/merchants`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getUserSpendingAnalytics(token: string, period: string = 'monthly'): Promise<any> {
    return this.request<any>(`/api/v1/dashboard/user/spending-analytics?period=${period}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getUserTransactionsByMerchant(token: string, merchantId: number, limit: number = 50, offset: number = 0): Promise<any[]> {
    return this.request<any[]>(`/api/v1/dashboard/user/transactions/${merchantId}?limit=${limit}&offset=${offset}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  // Order processing endpoints
  async processCheckout(checkoutData: any, token?: string): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth headers only if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<any>('/api/v1/orders/checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify(checkoutData),
    });
  }

  async getMerchantOrders(merchantId: number, token: string, limit: number = 50, offset: number = 0): Promise<any> {
    return this.request<any>(`/api/v1/orders/merchant/${merchantId}?limit=${limit}&offset=${offset}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async getUserOrders(userId: number, token: string, limit: number = 50, offset: number = 0): Promise<any> {
    return this.request<any>(`/api/v1/orders/user/${userId}?limit=${limit}&offset=${offset}`, {
      headers: this.getAuthHeaders(token),
    });
  }

  async subscribePushNotifications(subscriptionData: any): Promise<any> {
    return this.request<any>('/api/v1/orders/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(subscriptionData)
    });
  }

  async unsubscribePushNotifications(): Promise<any> {
    return this.request<any>('/api/v1/orders/push/unsubscribe', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });
  }

  async updateOrderStatus(orderId: string, status: string, token?: string): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth headers only if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return this.request<any>(`/api/v1/orders/${orderId}/status?status=${encodeURIComponent(status)}`, {
      method: 'PUT',
      headers
    });
  }
}

export const apiService = new ApiService();
export default apiService;
