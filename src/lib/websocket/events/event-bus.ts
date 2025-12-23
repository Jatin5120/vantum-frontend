/**
 * EventBus
 * Cross-component event communication
 */

import { EventEmitter } from './event-emitter';

// Define event types that can be published
export interface SocketEventBusEvents extends Record<string, unknown> {
  // Connection events
  connectionStateChanged: { state: string };
  
  // Response events
  responseStart: { utteranceId: string; timestamp: number };
  responseChunk: { audio: Uint8Array; utteranceId: string; sampleRate: number };
  responseComplete: { utteranceId: string };
  responseInterrupt: { utteranceId: string; timestamp: number };
  responseStop: { utteranceId: string; timestamp: number };
  
  // Error events
  error: { message: string; code: string; timestamp: number };
  
  // Connection ACK
  connectionAck: { sessionId: string };
}

class SocketEventBus extends EventEmitter<SocketEventBusEvents> {
  private static instance: SocketEventBus | null = null;

  static getInstance(): SocketEventBus {
    if (!SocketEventBus.instance) {
      SocketEventBus.instance = new SocketEventBus();
    }
    return SocketEventBus.instance;
  }

  private constructor() {
    super();
  }
}

export const eventBus = SocketEventBus.getInstance();

