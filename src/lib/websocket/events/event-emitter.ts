/**
 * EventEmitter
 * Lightweight event emitter for TypeScript
 */

import { logger } from '../../utils/logger';

type EventCallback<T = unknown> = (data: T) => void;

export class EventEmitter<TEventMap extends Record<string, unknown> = Record<string, unknown>> {
  private listeners = new Map<keyof TEventMap, Set<EventCallback>>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof TEventMap>(event: K, callback: EventCallback<TEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Subscribe to an event once (automatically unsubscribes after first emission)
   */
  once<K extends keyof TEventMap>(event: K, callback: EventCallback<TEventMap[K]>): () => void {
    const onceCallback: EventCallback<TEventMap[K]> = (data) => {
      this.off(event, onceCallback);
      callback(data);
    };
    return this.on(event, onceCallback);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof TEventMap>(event: K, callback: EventCallback<TEventMap[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event
   */
  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for ${String(event)}`, error, { event: String(event) });
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof TEventMap>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof TEventMap>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

