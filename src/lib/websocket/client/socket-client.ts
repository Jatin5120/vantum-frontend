/**
 * SocketClient
 * Low-level WebSocket connection management
 */

import { EventEmitter } from '../events/event-emitter';
import { NetworkMonitor } from './network-monitor';
import { logger } from '../../utils/logger';
import { wsConfig, WEBSOCKET_CONSTANTS } from '../config/websocket-config';
import type { ConnectionState, ClientEvents, ConnectionWaiter } from './types';

export class SocketClient extends EventEmitter<ClientEvents> {
  private ws: WebSocket | null = null;
  private currentUrl: string | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = wsConfig.maxReconnectAttempts;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private readonly connectionTimeout = wsConfig.connectionTimeout;
  private connectionWaiters = new Map<symbol, ConnectionWaiter>();

  // Ping/pong keepalive
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pingInterval = wsConfig.pingInterval;

  // Network monitoring
  private networkMonitor: NetworkMonitor;
  private networkMonitorUnsubscribe: (() => void) | null = null;

  // Reconnection delays (exponential backoff)
  private getReconnectDelay(): number {
    switch (this.reconnectAttempts) {
      case 0:
        return wsConfig.reconnectDelays.initial;
      case 1:
        return wsConfig.reconnectDelays.second;
      default:
        return wsConfig.reconnectDelays.max;
    }
  }

  constructor() {
    super();
    this.networkMonitor = new NetworkMonitor();
    this.setupNetworkMonitoring();
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    this.networkMonitorUnsubscribe = this.networkMonitor.on('change', ({ isOnline }) => {
      if (isOnline && !this.isConnected() && this.currentUrl) {
        // Network restored, attempt reconnection
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Connect to WebSocket server
   * @param url - WebSocket server URL
   * Note: Browser WebSocket API doesn't support custom headers.
   * Headers would need to be passed via URL params or subprotocol if needed.
   */
  connect(url: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('WebSocket already connected');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      logger.warn('WebSocket connection already in progress');
      return;
    }

    if (!this.networkMonitor.getStatus()) {
      logger.warn('Network unavailable, cannot connect');
      this.setState('error');
      return;
    }

    this.currentUrl = url;
    this.shouldReconnect = true;
    this.setState('connecting');

    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      
      // CRITICAL: Set binaryType immediately to avoid async Blob conversion
      ws.binaryType = 'arraybuffer';

      // Set handlers immediately to catch early messages (like connection.ack)
      ws.onopen = () => {
        logger.info('WebSocket connection opened', { url });
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.startPingTimer();
        this.resumeConnectionWaiters(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          this.emit('data', new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          logger.warn('Received unexpected string data from WebSocket');
        } else if (event.data instanceof Blob) {
          // Fallback for environments where binaryType might be ignored
          event.data.arrayBuffer().then((buffer) => {
            this.emit('data', new Uint8Array(buffer));
          });
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket native error', error);
        this.setState('error');
        this.emit('error', new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        logger.info('WebSocket connection closed', { 
          code: event.code, 
          reason: event.reason,
          wasClean: event.wasClean 
        });
        this.setState('disconnected');
        this.ws = null;
        this.stopPingTimer();
        this.resumeConnectionWaiters(false);

        if (this.shouldReconnect && event.code !== WEBSOCKET_CONSTANTS.CLOSE_CODES.NORMAL) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      logger.error('Failed to initiate WebSocket connection', error, { url });
      this.setState('error');
      this.emit('error', error instanceof Error ? error : new Error('Failed to create WebSocket'));
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(clear: boolean = false): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.resumeConnectionWaiters(false);

    if (this.ws) {
      this.ws.close(WEBSOCKET_CONSTANTS.CLOSE_CODES.NORMAL, 'Client disconnect');
      this.ws = null;
    }

    this.stopPingTimer();
    this.setState('disconnected');

    if (clear) {
      this.currentUrl = null;
    }
  }

  /**
   * Send binary data (waits for connection if needed)
   */
  async send(data: Uint8Array): Promise<void> {
    // Fast path: already connected
    if (this.isConnected() && this.ws) {
      return this.sendImmediately(data);
    }

    // Wait for connection
    await this.waitForConnection();

    // Now connected, send the message
    if (this.ws) {
      return this.sendImmediately(data);
    }

    throw new Error('WebSocket not available after connection');
  }

  /**
   * Send data immediately (assumes connection is ready)
   */
  private sendImmediately(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      try {
        this.ws.send(data);
        resolve();
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to send data'));
      }
    });
  }

  /**
   * Wait for connection with timeout
   */
  private waitForConnection(): Promise<void> {
    // Fast path: already connected
    if (this.isConnected()) {
      return Promise.resolve();
    }

    // Fail fast: no network or no URL
    if (!this.networkMonitor.getStatus() || !this.currentUrl) {
      return Promise.reject(new Error('Network unavailable or no URL'));
    }

    // Ensure connection attempt
    if (!this.isConnected() && this.networkMonitor.getStatus()) {
      this.connect(this.currentUrl);
    }

    // Wait for connection with timeout
    return new Promise((resolve, reject) => {
      const waiterId = Symbol('connection-waiter');
      const timeout = setTimeout(() => {
        const waiter = this.connectionWaiters.get(waiterId);
        if (waiter) {
          this.connectionWaiters.delete(waiterId);
          reject(new Error('Connection timeout'));
        }
      }, this.connectionTimeout);

      const waiter: ConnectionWaiter = {
        id: waiterId,
        resolve: () => {
          clearTimeout(timeout);
          this.connectionWaiters.delete(waiterId);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.connectionWaiters.delete(waiterId);
          reject(error);
        },
        timestamp: Date.now(),
      };

      // Check again if connected (race condition protection)
      if (this.isConnected()) {
        waiter.resolve();
        return; // Early return to avoid adding to map
      }
      this.connectionWaiters.set(waiterId, waiter);
    });
  }

  /**
   * Resume all waiting connection operations
   */
  private resumeConnectionWaiters(success: boolean): void {
    const waiters = Array.from(this.connectionWaiters.values());
    this.connectionWaiters.clear();

    waiters.forEach((waiter) => {
      if (success) {
        waiter.resolve();
      } else {
        waiter.reject(new Error('Connection failed'));
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (!this.shouldReconnect) {
      return;
    }

    if (!this.currentUrl) {
      return;
    }

    if (!this.networkMonitor.getStatus()) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', undefined, {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });
      this.setState('error');
      return;
    }

    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;
    this.setState('reconnecting');

    logger.info('Scheduling reconnect attempt', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (!this.networkMonitor.getStatus()) {
        this.setState('disconnected');
        return;
      }

      if (this.isConnected()) {
        return;
      }

      if (this.state === 'connecting') {
        return;
      }

      if (this.currentUrl) {
        this.connect(this.currentUrl);
      }
    }, delay);
  }

  /**
   * Start ping timer
   * Note: Browser WebSocket API doesn't expose ping() directly
   * We'll rely on the server's ping/pong mechanism or implement a custom keepalive
   */
  private startPingTimer(): void {
    this.stopPingTimer();

    // For now, we'll just monitor connection health
    // In production, you might want to send a custom ping message
    // that the server recognizes and responds to
    this.pingTimer = setInterval(() => {
      if (!this.isConnected() || !this.ws) {
        this.stopPingTimer();
        return;
      }

      // Check if connection is still alive
      if (this.ws.readyState !== WebSocket.OPEN) {
        this.handlePingFailure();
      }
    }, this.pingInterval);
  }

  /**
   * Stop ping timer
   */
  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Handle ping failure
   */
  private handlePingFailure(): void {
    logger.error('WebSocket ping failure, disconnecting');
    this.setState('disconnected');
    if (this.ws) {
      this.ws.close(WEBSOCKET_CONSTANTS.CLOSE_CODES.ABNORMAL, 'Ping failure');
      this.ws = null;
    }
    if (this.currentUrl && this.networkMonitor.getStatus()) {
      this.scheduleReconnect();
    }
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update state and emit event
   */
  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('state', newState);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disconnect(true);
    if (this.networkMonitorUnsubscribe) {
      this.networkMonitorUnsubscribe();
    }
    this.networkMonitor.destroy();
    this.removeAllListeners();
  }
}

