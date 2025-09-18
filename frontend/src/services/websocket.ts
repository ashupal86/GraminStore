/**
 * WebSocket service for real-time order updates
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private baseUrl: string) {}

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.baseUrl.replace('http', 'ws')}/api/v1/ws/orders/${token}`;
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
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(token);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
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
}

// Create singleton instance
const getWebSocketService = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://192.168.1.10:8009';
  return new WebSocketService(baseUrl);
};

export const wsService = getWebSocketService();
export default wsService;
