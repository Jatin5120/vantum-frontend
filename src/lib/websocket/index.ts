/**
 * WebSocket Library
 * Public API exports
 */

// Manager (High-Level API)
export { SocketManager } from './manager/socket-manager';

// Client (Low-Level API - for advanced use cases)
export { SocketClient } from './client/socket-client';
export { NetworkMonitor } from './client/network-monitor';

// Manager utilities
export { HandlerRegistry } from './manager/handler-registry';
export { RequestTracker } from './manager/request-tracker';
export type { SocketEventHandler } from './manager/handler-registry';

// Events
export { EventEmitter } from './events/event-emitter';
export { eventBus } from './events/event-bus';

// Types
export * from './types';
export type { ConnectionState, ClientEvents } from './client/types';

// MessagePack utilities
export * from './message-pack';

