export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingItems: number;
  isSyncing: boolean;
  syncError: string | null;
}
