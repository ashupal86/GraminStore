import { db } from './indexedDB';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingItems: number;
  isSyncing: boolean;
  syncError: string | null;
}

class SyncService {
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingItems: 0,
    isSyncing: false,
    syncError: null
  };

  private listeners: ((status: SyncStatus) => void)[] = [];
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.syncStatus.syncError = null;
      this.notifyListeners();
      this.performSync();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
      this.notifyListeners();
    });
  }

  private startPeriodicSync() {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.isSyncing) {
        this.performSync();
      }
    }, 30000);
  }

  public subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.syncStatus));
  }

  public getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public async performSync(merchantId?: number): Promise<{ success: boolean; syncedItems: number; error?: string }> {
    if (!this.syncStatus.isOnline || this.syncStatus.isSyncing) {
      return { success: false, syncedItems: 0, error: 'Offline or already syncing' };
    }

    if (!merchantId) {
      return { success: false, syncedItems: 0, error: 'Merchant ID required' };
    }

    this.syncStatus.isSyncing = true;
    this.syncStatus.syncError = null;
    this.notifyListeners();

    try {
      // Get pending data count
      const pendingData = await db.getPendingSyncData(merchantId);
      this.syncStatus.pendingItems = pendingData.transactions.length + pendingData.customers.length;
      this.notifyListeners();

      // Sync transactions
      let syncedTransactions = 0;
      for (const transaction of pendingData.transactions) {
        try {
          // Convert IndexedDB transaction to API format
          const apiTransaction = {
            merchant_id: transaction.merchantId,
            customer_name: transaction.customerName,
            customer_phone: transaction.customerPhone,
            amount: transaction.amount,
            description: transaction.description,
            payment_type: transaction.paymentType,
            status: transaction.status,
            created_at: transaction.createdAt.toISOString(),
          };

          // This would be the actual API call
          // await apiService.createTransaction(apiTransaction);
          console.log('Syncing transaction:', apiTransaction);
          
          // Mark as synced
          await db.markAsSynced('transaction', [transaction.id!]);
          syncedTransactions++;
        } catch (error) {
          console.error('Failed to sync transaction:', transaction.id, error);
          await db.transactions.update(transaction.id!, { syncStatus: 'failed' });
        }
      }

      // Sync customers
      let syncedCustomers = 0;
      for (const customer of pendingData.customers) {
        try {
          // Convert IndexedDB customer to API format
          const apiCustomer = {
            merchant_id: customer.merchantId,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            total_transactions: customer.totalTransactions,
            total_amount: customer.totalAmount,
            last_transaction_date: customer.lastTransactionDate?.toISOString(),
            is_guest: customer.isGuest || false,
            platform_user_id: customer.platformUserId,
          };

          // This would be the actual API call
          // await apiService.createCustomer(apiCustomer);
          console.log('Syncing customer:', apiCustomer);
          
          // Mark as synced
          await db.markAsSynced('customer', [customer.id!]);
          syncedCustomers++;
        } catch (error) {
          console.error('Failed to sync customer:', customer.id, error);
          await db.customers.update(customer.id!, { syncStatus: 'failed' });
        }
      }

      const totalSynced = syncedTransactions + syncedCustomers;
      this.syncStatus.lastSyncTime = new Date();
      this.syncStatus.pendingItems = Math.max(0, this.syncStatus.pendingItems - totalSynced);
      this.syncStatus.isSyncing = false;
      this.notifyListeners();

      return { success: true, syncedItems: totalSynced };
    } catch (error) {
      console.error('Sync failed:', error);
      this.syncStatus.isSyncing = false;
      this.syncStatus.syncError = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners();
      return { success: false, syncedItems: 0, error: this.syncStatus.syncError };
    }
  }

  public async forceSync(merchantId: number): Promise<{ success: boolean; syncedItems: number; error?: string }> {
    return this.performSync(merchantId);
  }

  public async getPendingCount(merchantId: number): Promise<number> {
    const pendingData = await db.getPendingSyncData(merchantId);
    return pendingData.transactions.length + pendingData.customers.length;
  }

  public destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners = [];
  }
}

// Create singleton instance
export const syncService = new SyncService();
