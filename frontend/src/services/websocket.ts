/**
 * WebSocket service for real-time order updates
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/v1/ws/orders/${token}`;
        console.log('Attempting to connect to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.ws = null;
          
          // Don't attempt to reconnect if it's a policy violation (CORS/security issue)
          if (event.code === 1008) {
            console.log('WebSocket connection blocked by security policy. WebSocket features will be disabled.');
            resolve(); // Resolve instead of reject to prevent app crashes
            return;
          }
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(token);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Don't reject on error - just log it and resolve to prevent app crashes
          console.log('WebSocket connection failed. Real-time features will be disabled.');
          resolve();
        };

      } catch (error) {
        console.error('WebSocket connection error:', error);
        // Don't reject on error - just log it and resolve to prevent app crashes
        console.log('WebSocket connection failed. Real-time features will be disabled.');
        resolve();
      }
    });
  }

  private scheduleReconnect(token: string) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(token).catch(() => {
        // Reconnection failed, will be handled by onclose
      });
    }, delay);
  }

  private handleMessage(data: any) {
    const { type } = data;
    console.log('WebSocket message received:', data);
    
    // Emit to specific listeners
    if (this.listeners.has(type)) {
      console.log(`Emitting to ${type} listeners:`, this.listeners.get(type)?.length);
      this.listeners.get(type)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }

    // Emit to general listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*')?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  requestOrders(limit: number = 50, offset: number = 0, days: number = 30) {
    this.send({
      type: 'get_orders',
      limit,
      offset,
      days
    });
  }

  ping() {
    this.send({ type: 'ping' });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  isWebSocketSupported(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  getConnectionStatus(): string {
    if (!this.isWebSocketSupported()) {
      return 'not-supported';
    }
    if (this.ws === null) {
      return 'disconnected';
    }
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }
}

// Create singleton instance
const getWebSocketService = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://graminstore-backend-53e13181bd39.herokuapp.com';
  return new WebSocketService(baseUrl);
};

export const wsService = getWebSocketService();
export default wsService;
