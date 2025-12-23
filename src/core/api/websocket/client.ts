/**
 * API Framework - WebSocket Client
 * 
 * WebSocket integration with automatic reconnection and message queuing
 */

import type { WebSocketRequest, WebSocketResponse } from '../types';

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectAttempts?: number;
  queueMessages?: boolean;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private messageQueue: WebSocketRequest[] = [];
  private pendingRequests = new Map<string, {
    resolve: (response: WebSocketResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, Array<(data: unknown) => void>>();
  private requestIdCounter = 0;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols,
      reconnectDelay: config.reconnectDelay || 1000,
      maxReconnectDelay: config.maxReconnectDelay || 30000,
      reconnectAttempts: config.reconnectAttempts || Infinity,
      queueMessages: config.queueMessages ?? true,
    };

    this.connect();
  }

  /**
   * Connect to WebSocket
   */
  private connect(): void {
    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      this.handleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.emit('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data) as WebSocketResponse;
        this.handleMessage(response);
      } catch (error) {
        // Not JSON, emit as raw message
        this.emit('message', event.data);
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      this.emit('close');
      this.handleReconnect();
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(response: WebSocketResponse): void {
    if (response.requestId) {
      const pending = this.pendingRequests.get(response.requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response);
        }
        this.pendingRequests.delete(response.requestId);
        return;
      }
    }

    // Emit as event if no request ID
    if (response.type) {
      this.emit(response.type, response.data);
    } else {
      this.emit('message', response);
    }
  }

  /**
   * Send message
   */
  send(data: WebSocketRequest): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.config.queueMessages) {
        this.messageQueue.push(data);
      }
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
    } catch (error) {
      if (this.config.queueMessages) {
        this.messageQueue.push(data);
      }
    }
  }

  /**
   * Send request and wait for response
   */
  async request<T = unknown>(
    type: string,
    data?: Record<string, unknown>,
    timeout: number = 5000
  ): Promise<WebSocketResponse<T>> {
    const requestId = `req_${++this.requestIdCounter}`;
    const request: WebSocketRequest = {
      type,
      data,
      requestId,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('WebSocket request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (response: WebSocketResponse) => void,
        reject,
        timeout: timeoutId,
      });

      this.send(request);
    });
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('WebSocket disconnected'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Add event listener
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}


