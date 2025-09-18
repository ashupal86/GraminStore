import { useState, useEffect } from 'react';
import { syncService, type SyncStatus } from '../services/syncService';

export const useSync = (merchantId?: number) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingItems: 0,
    isSyncing: false,
    syncError: null
  });

  useEffect(() => {
    // Initialize with current status
    try {
      const currentStatus = syncService.getStatus();
      setSyncStatus(currentStatus);
    } catch (error) {
      console.error('Error getting sync status:', error);
    }

    // Subscribe to updates
    const unsubscribe = syncService.subscribe(setSyncStatus);
    return unsubscribe;
  }, []);

  const performSync = async () => {
    if (!merchantId) return { success: false, syncedItems: 0, error: 'Merchant ID required' };
    try {
      return await syncService.performSync(merchantId);
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, syncedItems: 0, error: 'Sync failed' };
    }
  };

  const forceSync = async () => {
    if (!merchantId) return { success: false, syncedItems: 0, error: 'Merchant ID required' };
    try {
      return await syncService.forceSync(merchantId);
    } catch (error) {
      console.error('Force sync error:', error);
      return { success: false, syncedItems: 0, error: 'Force sync failed' };
    }
  };

  const getPendingCount = async () => {
    if (!merchantId) return 0;
    try {
      return await syncService.getPendingCount(merchantId);
    } catch (error) {
      console.error('Get pending count error:', error);
      return 0;
    }
  };

  return {
    syncStatus,
    performSync,
    forceSync,
    getPendingCount,
  };
};
