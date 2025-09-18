export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: {
    rate: number;
    count: number;
  };
}

export interface InventoryItem {
  id: number;
  name: string;
  description: string;
  category: string;
  sku: string;
  current_quantity: number;
  unit_price: number;
  unit: string;
  merchant_id: number;
}

export interface Merchant {
  id: number;
  name: string;
  business_name: string;
  city: string;
  state: string;
  categories: { [category: string]: InventoryItem[] };
}

export interface SearchResult {
  id: number;
  name: string;
  description: string;
  category: string;
  sku: string;
  current_quantity: number;
  unit_price: number;
  unit: string;
  merchant: {
    id: number;
    name: string;
    business_name: string;
    city: string;
    state: string;
  };
}

export interface CartItem {
  id: number;
  name: string;
  unit_price: number;
  quantity: number;
  unit: string;
  merchant_id: number;
  merchant_name: string;
  category: string;
}

export interface Category {
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

export interface MarketplaceState {
  merchants: Merchant[];
  categories: Category[];
  selectedCategory: string | null;
  selectedMerchant: number | null;
  searchResults: SearchResult[];
  cart: CartItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  viewMode: 'merchants' | 'search'; // 'merchants' for shop view, 'search' for search results
}
