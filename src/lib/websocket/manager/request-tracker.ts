/**
 * RequestTracker
 * Track pending requests for ACK matching
 */

import { wsConfig } from '../config/websocket-config';
import type { UnpackedMessage } from '@Jatin5120/vantum-shared';

export interface PendingRequest {
  eventId: string;
  eventType: string;
  timestamp: number;
  resolve: (ack: UnpackedMessage) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class RequestTracker {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly defaultTimeout = wsConfig.requestTracker.defaultTimeout;
  private readonly maxPendingRequests = wsConfig.requestTracker.maxPendingRequests;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of old requests
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldRequests();
    }, wsConfig.requestTracker.cleanupInterval);
  }

  /**
   * Cleanup old requests that have exceeded their timeout
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const maxAge = this.defaultTimeout * 2; // Clean up requests older than 2x timeout

    for (const [eventId, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > maxAge) {
        clearTimeout(request.timeout);
        request.reject(new Error(`Request cleanup: ${request.eventType} (${eventId})`));
        this.pendingRequests.delete(eventId);
      }
    }
  }

  /**
   * Track a sent request
   * Returns existing promise if duplicate eventId is detected
   */
  trackRequest(
    eventId: string,
    eventType: string,
    timeout: number = this.defaultTimeout
  ): Promise<UnpackedMessage> {
    // Check for duplicate request
    const existingRequest = this.pendingRequests.get(eventId);
    if (existingRequest) {
      // Return existing promise for duplicate request
      return Promise.resolve({} as UnpackedMessage).then(() => {
        // Wait for the original request to resolve
        return new Promise<UnpackedMessage>((resolve, reject) => {
          // This is a simplified approach - in practice, you might want to
          // track multiple listeners for the same request
          const originalResolve = existingRequest.resolve;
          existingRequest.resolve = (ack: UnpackedMessage) => {
            originalResolve(ack);
            resolve(ack);
          };
          const originalReject = existingRequest.reject;
          existingRequest.reject = (error: Error) => {
            originalReject(error);
            reject(error);
          };
        });
      });
    }

    // Enforce max pending requests limit
    if (this.pendingRequests.size >= this.maxPendingRequests) {
      // Remove oldest request
      const oldestEntry = Array.from(this.pendingRequests.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldestEntry) {
        clearTimeout(oldestEntry[1].timeout);
        oldestEntry[1].reject(new Error('Request tracker limit reached'));
        this.pendingRequests.delete(oldestEntry[0]);
      }
    }

    return new Promise((resolve, reject) => {
      const request: PendingRequest = {
        eventId,
        eventType,
        timestamp: Date.now(),
        resolve,
        reject,
        timeout: setTimeout(() => {
          // Only handle timeout if request is still pending
          const pendingRequest = this.pendingRequests.get(eventId);
          if (pendingRequest) {
            this.handleTimeout(eventId);
            reject(new Error(`Request timeout for ${eventType} (${eventId})`));
          }
        }, timeout),
      };

      this.pendingRequests.set(eventId, request);
    });
  }

  /**
   * Match ACK to request
   */
  matchAck(eventId: string, ackMessage: UnpackedMessage): boolean {
    const request = this.pendingRequests.get(eventId);
    if (!request) {
      return false;
    }

    // Clear timeout first to prevent double resolution
    clearTimeout(request.timeout);

    // Remove from map before resolving to prevent race conditions
    this.pendingRequests.delete(eventId);

    // Now safe to resolve
    request.resolve(ackMessage);

    return true;
  }

  /**
   * Handle request timeout
   */
  private handleTimeout(eventId: string): void {
    const request = this.pendingRequests.get(eventId);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(eventId);
    }
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(eventId: string): void {
    const request = this.pendingRequests.get(eventId);
    if (request) {
      clearTimeout(request.timeout);
      request.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(eventId);
    }
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.forEach((request) => {
      clearTimeout(request.timeout);
      request.reject(new Error('Request tracker cleared'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Stop cleanup timer and clear all requests
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

