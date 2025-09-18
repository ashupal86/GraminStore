/**
 * Push notification service for order updates
 */
class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push messaging is not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async subscribe(): Promise<boolean> {
    if (!this.registration) {
      console.error('Service worker not initialized');
      return false;
    }

    try {
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa40HIcFdYz2w1LJFCgK3dTMcg6SQfpY2cbONn3_5xV3gVzHpS64EFSxUuFjM'
        )
      });

      console.log('Push subscription successful:', this.subscription);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const result = await this.subscription.unsubscribe();
      this.subscription = null;
      console.log('Push unsubscription successful:', result);
      return result;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      return null;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('Failed to get push subscription:', error);
      return null;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  getSubscriptionData(): any {
    if (!this.subscription) {
      return null;
    }

    return {
      endpoint: this.subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(this.subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(this.subscription.getKey('auth')!)
      }
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const pushNotificationService = new PushNotificationService();
