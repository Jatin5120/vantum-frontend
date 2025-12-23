/**
 * HandlerRegistry
 * Event handler registration and routing
 */

import { logger } from '../../utils/logger';
import type { UnpackedMessage } from '@Jatin5120/vantum-shared';
import type { SocketManager } from './socket-manager';

export interface SocketEventHandler {
  handle(
    data: Uint8Array,
    eventType: string,
    manager: SocketManager,
    unpackedMessage?: UnpackedMessage
  ): Promise<void>;
}

export class HandlerRegistry {
  private handlers = new Map<string, SocketEventHandler>();
  private errorHandlers = new Map<string, SocketEventHandler>();

  /**
   * Register a handler for an event type
   */
  registerHandler(eventType: string, handler: SocketEventHandler): void {
    this.handlers.set(eventType, handler);
  }

  /**
   * Register an error handler for an event type
   */
  registerErrorHandler(eventType: string, handler: SocketEventHandler): void {
    this.errorHandlers.set(eventType, handler);
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(eventType: string): void {
    this.handlers.delete(eventType);
    this.errorHandlers.delete(eventType);
  }

  /**
   * Get handler for event type
   */
  getHandler(eventType: string): SocketEventHandler | undefined {
    return this.handlers.get(eventType);
  }

  /**
   * Get error handler for event type
   */
  getErrorHandler(eventType: string): SocketEventHandler | undefined {
    // Check for exact match first
    if (this.errorHandlers.has(eventType)) {
      return this.errorHandlers.get(eventType);
    }

    // Check for error event pattern (eventType.endsWith('.error'))
    if (eventType.endsWith('.error')) {
      // Try to find handler for base event type
      const baseEventType = eventType.replace(/\.error$/, '');
      return this.errorHandlers.get(baseEventType);
    }

    return undefined;
  }

  /**
   * Route message to appropriate handler
   */
  async routeMessage(
    data: Uint8Array,
    eventType: string,
    manager: SocketManager,
    unpackedMessage?: UnpackedMessage
  ): Promise<boolean> {
    try {
      // Check if it's an error event
      if (eventType.endsWith('.error')) {
        // First try error handler registry
        const errorHandler = this.getErrorHandler(eventType);
        if (errorHandler) {
          await errorHandler.handle(data, eventType, manager, unpackedMessage);
          return true;
        }
        
        // Fallback: check regular handlers for error events (e.g., "error" key for wildcard)
        const wildcardErrorHandler = this.getHandler('error');
        if (wildcardErrorHandler) {
          await wildcardErrorHandler.handle(data, eventType, manager, unpackedMessage);
          return true;
        }
      }

      // Try regular handler
      const handler = this.getHandler(eventType);
      if (handler) {
        await handler.handle(data, eventType, manager, unpackedMessage);
        return true;
      }
    } catch (error) {
      logger.error(`Error in handler for ${eventType}`, error, { eventType });
      // Optionally emit error event to manager
      return false;
    }

    return false;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.errorHandlers.clear();
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

