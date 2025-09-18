import Dexie from 'dexie';
import type { Table } from 'dexie';

// Database interfaces
export interface Transaction {
  id?: number;
  merchantId: number;
  customerName: string;
  customerPhone?: string;
  amount: number;
  description: string;
  paymentType: 'instant' | 'payLater';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'failed';
}

export interface Customer {
  id?: number;
  merchantId: number;
  name: string;
  phone?: string;
  email?: string;
  totalTransactions: number;
  totalAmount: number;
  lastTransactionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'failed';
  isGuest?: boolean;
  platformUserId?: number; // Reference to platform user if not guest
}

export interface OfflineSettings {
  id?: number;
  merchantId: number;
  language: string;
  autoSync: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  updatedAt: Date;
}

export interface CalculationHistoryEntry {
  id?: number;
  merchantId: number;
  expression: string;
  result: number;
  timestamp: Date;
}

// Database class
export class GraminStoreDB extends Dexie {
  transactions!: Table<Transaction>;
  customers!: Table<Customer>;
  settings!: Table<OfflineSettings>;
  calculationHistory!: Table<CalculationHistoryEntry>;

  constructor() {
    super('GraminStoreDB');
    
    this.version(1).stores({
      transactions: '++id, merchantId, customerName, amount, paymentType, status, createdAt, syncStatus',
      customers: '++id, merchantId, name, phone, totalTransactions, totalAmount, createdAt, syncStatus',
      settings: '++id, merchantId, language, theme, updatedAt',
    });

    this.version(2).stores({
      transactions: '++id, merchantId, customerName, amount, paymentType, status, createdAt, syncStatus',
      customers: '++id, merchantId, name, phone, totalTransactions, totalAmount, createdAt, syncStatus',
      settings: '++id, merchantId, language, theme, updatedAt',
      calculationHistory: '++id, merchantId, timestamp'
    });
  }

  // Transaction methods
  async addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) {
    const now = new Date();
    const newTransaction: Omit<Transaction, 'id'> = {
      ...transaction,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    
    const id = await this.transactions.add(newTransaction);
    
    // Update customer data
    await this.updateCustomerStats(transaction.merchantId, transaction.customerName, transaction.amount);
    
    return id;
  }

  async getTransactions(merchantId: number, limit = 50) {
    return await this.transactions
      .where('merchantId')
      .equals(merchantId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async updateTransactionStatus(id: number, status: Transaction['status']) {
    return await this.transactions.update(id, {
      status,
      updatedAt: new Date(),
      syncStatus: 'pending',
    });
  }

  // Customer methods
  async updateCustomerStats(merchantId: number, customerName: string, amount: number) {
    const existingCustomer = await this.customers
      .where({ merchantId, name: customerName })
      .first();

    if (existingCustomer) {
      await this.customers.update(existingCustomer.id!, {
        totalTransactions: existingCustomer.totalTransactions + 1,
        totalAmount: existingCustomer.totalAmount + amount,
        lastTransactionDate: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
      });
    } else {
      const newCustomer: Omit<Customer, 'id'> = {
        merchantId,
        name: customerName,
        totalTransactions: 1,
        totalAmount: amount,
        lastTransactionDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
      };
      await this.customers.add(newCustomer);
    }
  }

  async getCustomers(merchantId: number) {
    return await this.customers
      .where('merchantId')
      .equals(merchantId)
      .reverse()
      .toArray();
  }

  async getCustomersByMerchant(merchantId: number) {
    return await this.customers
      .where('merchantId')
      .equals(merchantId)
      .reverse()
      .toArray();
  }

  async addCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) {
    const now = new Date();
    const newCustomer: Omit<Customer, 'id'> = {
      ...customer,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };
    
    const id = await this.customers.add(newCustomer);
    return { ...newCustomer, id };
  }

  async updateCustomerTotals(customerId: number, amount: number) {
    const customer = await this.customers.get(customerId);
    if (customer) {
      await this.customers.update(customerId, {
        totalTransactions: customer.totalTransactions + 1,
        totalAmount: customer.totalAmount + amount,
        lastTransactionDate: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending',
      });
    }
  }

  // Settings methods
  async saveSettings(settings: Omit<OfflineSettings, 'id' | 'updatedAt'>) {
    const existingSettings = await this.settings
      .where('merchantId')
      .equals(settings.merchantId)
      .first();

    const settingsData = {
      ...settings,
      updatedAt: new Date(),
    };

    if (existingSettings) {
      await this.settings.update(existingSettings.id!, settingsData);
    } else {
      await this.settings.add(settingsData);
    }
  }

  async getSettings(merchantId: number): Promise<OfflineSettings | undefined> {
    return await this.settings
      .where('merchantId')
      .equals(merchantId)
      .first();
  }

  // Analytics methods
  async getMerchantStats(merchantId: number) {
    const transactions = await this.getTransactions(merchantId, 1000);
    const customers = await this.getCustomers(merchantId);

    const totalRevenue = transactions
      .filter((t: Transaction) => t.status === 'completed')
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const pendingAmount = transactions
      .filter((t: Transaction) => t.status === 'pending' && t.paymentType === 'payLater')
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const totalTransactions = transactions.length;
    const totalCustomers = customers.length;

    // Recent transactions (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentTransactions = transactions.filter((t: Transaction) => t.createdAt >= weekAgo);

    return {
      totalRevenue,
      pendingAmount,
      totalTransactions,
      totalCustomers,
      recentTransactions: recentTransactions.length,
      topCustomers: customers.slice(0, 5),
    };
  }

  // Sync methods
  async getPendingSyncData(merchantId: number) {
    const pendingTransactions = await this.transactions
      .where({ merchantId, syncStatus: 'pending' })
      .toArray();

    const pendingCustomers = await this.customers
      .where({ merchantId, syncStatus: 'pending' })
      .toArray();

    return {
      transactions: pendingTransactions,
      customers: pendingCustomers,
    };
  }

  async markAsSynced(type: 'transaction' | 'customer', ids: number[]) {
    const table = type === 'transaction' ? this.transactions : this.customers;
    
    for (const id of ids) {
      await table.update(id, { syncStatus: 'synced' });
    }
  }

  async clearMerchantData(merchantId: number) {
    await this.transactions.where('merchantId').equals(merchantId).delete();
    await this.customers.where('merchantId').equals(merchantId).delete();
    await this.settings.where('merchantId').equals(merchantId).delete();
  }

  // Calculation History methods (local only)
  async addCalculationHistory(entry: Omit<CalculationHistoryEntry, 'id'>) {
    return await this.calculationHistory.add(entry);
  }

  async getCalculationHistory(merchantId: number, limit = 50) {
    return await this.calculationHistory
      .where('merchantId')
      .equals(merchantId)
      .reverse()
      .limit(limit)
      .toArray();
  }

  // Enhanced sync methods
  async syncWithServer(merchantId: number) {
    if (!navigator.onLine) {
      throw new Error('No internet connection');
    }

    const pendingData = await this.getPendingSyncData(merchantId);
    const syncedIds: { transactions: number[], customers: number[] } = {
      transactions: [],
      customers: []
    };

    try {
      // Sync transactions
      for (const transaction of pendingData.transactions) {
        try {
          // This would be an actual API call
          // await apiService.syncTransaction(transaction);
          console.log('Syncing transaction:', transaction);
          syncedIds.transactions.push(transaction.id!);
        } catch (error) {
          console.error('Failed to sync transaction:', transaction.id, error);
          await this.transactions.update(transaction.id!, { syncStatus: 'failed' });
        }
      }

      // Sync customers
      for (const customer of pendingData.customers) {
        try {
          // This would be an actual API call
          // await apiService.syncCustomer(customer);
          console.log('Syncing customer:', customer);
          syncedIds.customers.push(customer.id!);
        } catch (error) {
          console.error('Failed to sync customer:', customer.id, error);
          await this.customers.update(customer.id!, { syncStatus: 'failed' });
        }
      }

      // Mark successfully synced items
      await this.markAsSynced('transaction', syncedIds.transactions);
      await this.markAsSynced('customer', syncedIds.customers);

      return {
        success: true,
        syncedTransactions: syncedIds.transactions.length,
        syncedCustomers: syncedIds.customers.length
      };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // User balance methods
  async getUserBalance(merchantId: number, userPhone: string) {
    const userTransactions = await this.transactions
      .where({ merchantId })
      .filter(t => t.customerPhone === userPhone)
      .toArray();

    const pending = userTransactions
      .filter(t => t.status === 'pending' && t.paymentType === 'payLater')
      .reduce((sum, t) => sum + t.amount, 0);

    const paid = userTransactions
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      pending,
      paid,
      balance: paid - pending
    };
  }

  // Search customers by phone or name
  async searchCustomers(merchantId: number, query: string) {
    const customers = await this.customers
      .where('merchantId')
      .equals(merchantId)
      .toArray();

    return customers.filter(customer => 
      customer.name.toLowerCase().includes(query.toLowerCase()) ||
      (customer.phone && customer.phone.includes(query)) ||
      (customer.email && customer.email.toLowerCase().includes(query.toLowerCase()))
    );
  }

  // Get transaction history for a specific user
  async getUserTransactionHistory(merchantId: number, userPhone: string, limit = 20) {
    return await this.transactions
      .where({ merchantId })
      .filter(t => t.customerPhone === userPhone)
      .reverse()
      .limit(limit)
      .toArray();
  }

  // Auto-sync when coming online
  async handleOnlineSync(merchantId: number) {
    if (navigator.onLine) {
      try {
        const result = await this.syncWithServer(merchantId);
        console.log('Auto-sync completed:', result);
        return result;
      } catch (error) {
        console.error('Auto-sync failed:', error);
        return { success: false, error };
      }
    }
    return { success: false, error: 'Offline' };
  }
}

// Create database instance
export const db = new GraminStoreDB();
