/**
 * SocketManager
 * High-level WebSocket API with message handling and event routing
 */

import { pack, unpack } from 'msgpackr';
import { SocketClient } from '../client/socket-client';
import { HandlerRegistry, type SocketEventHandler } from './handler-registry';
import { RequestTracker } from './request-tracker';
import { eventBus } from '../events/event-bus';
import { logger } from '../../utils/logger';
import type { ConnectionState } from '../client/types';
import {
  type EventMessage,
  type UnpackedMessage,
  VOICECHAT_EVENTS,
} from '@Jatin5120/vantum-shared';

export class SocketManager {
  private client: SocketClient;
  private handlerRegistry: HandlerRegistry;
  private requestTracker: RequestTracker;
  private connectionState: ConnectionState = 'disconnected';
  private sessionId: string | undefined;
  private stateChangeCallbacks = new Set<(state: ConnectionState) => void>();

  constructor() {
    this.client = new SocketClient();
    this.handlerRegistry = new HandlerRegistry();
    this.requestTracker = new RequestTracker();
    this.setupClientListeners();
  }

  /**
   * Setup client event listeners
   */
  private setupClientListeners(): void {
    this.client.on('state', (state) => {
      this.connectionState = state;
      this.stateChangeCallbacks.forEach((callback) => callback(state));
      // Publish to event bus
      eventBus.emit('connectionStateChanged', { state: state as string });
    });

    this.client.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.client.on('error', (error) => {
      logger.error('SocketManager error', error);
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect(url: string): void {
    this.client.connect(url);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(clear: boolean = false): void {
    this.client.disconnect(clear);
    this.requestTracker.clear();
    this.sessionId = undefined;
  }

  /**
   * Send MessagePack event
   */
  async sendMessagePack<T>(event: EventMessage<T>): Promise<string> {
    const data = pack(event);
    await this.client.send(data);
    return event.eventId;
  }

  /**
   * Send MessagePack event and track for ACK
   */
  async sendMessagePackWithAck<T>(
    event: EventMessage<T>,
    timeout?: number
  ): Promise<UnpackedMessage> {
    // Track the request
    const ackPromise = this.requestTracker.trackRequest(
      event.eventId,
      event.eventType,
      timeout
    );

    // Send the message
    await this.sendMessagePack(event);

    // Return the ACK promise
    return ackPromise;
  }

  /**
   * Register event handler
   */
  registerHandler(eventType: string, handler: SocketEventHandler): void {
    this.handlerRegistry.registerHandler(eventType, handler);
  }

  /**
   * Register error handler
   */
  registerErrorHandler(eventType: string, handler: SocketEventHandler): void {
    this.handlerRegistry.registerErrorHandler(eventType, handler);
  }

  /**
   * Unregister handler
   */
  unregisterHandler(eventType: string): void {
    this.handlerRegistry.unregisterHandler(eventType);
  }

  /**
   * Handle incoming data
   */
  private async handleIncomingData(data: Uint8Array): Promise<void> {
    try {
      const message = unpack(data) as UnpackedMessage;

      if (!message.eventType) {
        logger.warn('Received message without eventType', { message });
        return;
      }

      logger.debug('Incoming WebSocket message', { 
        type: message.eventType, 
        sessionId: message.sessionId,
        eventId: message.eventId 
      });

      // Internal handling for connection establishment
      if (message.eventType === VOICECHAT_EVENTS.CONNECTION_ACK && message.sessionId) {
        this.sessionId = message.sessionId;
        logger.info('Session ID initialized in manager', { sessionId: this.sessionId });
        eventBus.emit('connectionAck', { sessionId: this.sessionId });
      }

      // Check if this is an ACK (same eventType as a pending request, payload has success: true)
      const isAck = this.checkIfAck(message);
      if (isAck && message.eventId) {
        // Try to match with pending request
        const matched = this.requestTracker.matchAck(message.eventId, message);
        if (matched) {
          // ACK matched, request tracker will resolve the promise
          return;
        }
        // If not matched, continue to handler routing
      }

      // Route to handler (pass unpacked message to avoid re-unpacking)
      const handled = await this.handlerRegistry.routeMessage(
        data,
        message.eventType,
        this,
        message
      );

      if (!handled) {
        logger.warn('Unhandled event type', { 
          eventType: message.eventType,
          registeredHandlers: this.handlerRegistry.getRegisteredEventTypes(),
        });
      }
    } catch (error) {
      logger.error('Failed to handle incoming data', error);
    }
  }

  /**
   * Check if message is an ACK
   */
  private checkIfAck(message: UnpackedMessage): boolean {
    if (typeof message.payload !== 'object' || message.payload === null) {
      return false;
    }

    // ACK must have eventId to match with request
    if (!message.eventId) {
      return false;
    }

    const payload = message.payload as Record<string, unknown>;
    return payload.success === true;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  /**
   * Get MessagePack decoder helper
   */
  decodeMessagePack<T = unknown>(data: Uint8Array): T {
    return unpack(data) as T;
  }

  /**
   * Get MessagePack encoder helper
   */
  encodeMessagePack<T>(object: T): Uint8Array {
    return pack(object);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disconnect(true);
    this.handlerRegistry.clear();
    this.requestTracker.destroy();
    this.client.destroy();
  }
}

