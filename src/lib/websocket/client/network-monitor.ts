/**
 * NetworkMonitor
 * Monitor network availability and emit status changes
 */

import { EventEmitter } from '../events/event-emitter';
import { WEBSOCKET_CONSTANTS } from '../constants';

export interface NetworkMonitorEvents extends Record<string, unknown> {
  online: void;
  offline: void;
  change: { isOnline: boolean };
}

export class NetworkMonitor extends EventEmitter<NetworkMonitorEvents> {
  private isOnline: boolean;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceDelay = WEBSOCKET_CONSTANTS.NETWORK_MONITOR.DEBOUNCE_DELAY;

  constructor() {
    super();
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.setupListeners();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = (): void => {
    this.debounce(() => {
      if (!this.isOnline) {
        this.isOnline = true;
        this.emit('online', undefined);
        this.emit('change', { isOnline: true });
      }
    });
  };

  private handleOffline = (): void => {
    this.debounce(() => {
      if (this.isOnline) {
        this.isOnline = false;
        this.emit('offline', undefined);
        this.emit('change', { isOnline: false });
      }
    });
  };

  private debounce(callback: () => void): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      callback();
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Get current network status
   */
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.removeAllListeners();
  }
}

