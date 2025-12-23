/**
 * WebSocket Configuration
 * Centralized configuration for WebSocket connections
 */

export interface WebSocketConfig {
  // Connection settings
  connectionTimeout: number;
  maxReconnectAttempts: number;
  pingInterval: number;

  // Reconnection delays (exponential backoff in ms)
  reconnectDelays: {
    initial: number;
    second: number;
    max: number;
  };

  // Request tracking
  requestTracker: {
    defaultTimeout: number;
    maxPendingRequests: number;
    cleanupInterval: number;
  };
}

const defaultConfig: WebSocketConfig = {
  connectionTimeout: 30000, // 30 seconds
  maxReconnectAttempts: 6,
  pingInterval: 30000, // 30 seconds

  reconnectDelays: {
    initial: 2000, // 2 seconds
    second: 5000, // 5 seconds
    max: 10000, // 10 seconds
  },

  requestTracker: {
    defaultTimeout: 30000, // 30 seconds
    maxPendingRequests: 100,
    cleanupInterval: 60000, // 1 minute
  },
};

/**
 * Get WebSocket configuration
 * Can be overridden via environment variables
 */
export function getWebSocketConfig(): WebSocketConfig {
  return {
    connectionTimeout: Number(import.meta.env.VITE_WS_CONNECTION_TIMEOUT) || defaultConfig.connectionTimeout,
    maxReconnectAttempts: Number(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS) || defaultConfig.maxReconnectAttempts,
    pingInterval: Number(import.meta.env.VITE_WS_PING_INTERVAL) || defaultConfig.pingInterval,

    reconnectDelays: {
      initial: Number(import.meta.env.VITE_WS_RECONNECT_DELAY_INITIAL) || defaultConfig.reconnectDelays.initial,
      second: Number(import.meta.env.VITE_WS_RECONNECT_DELAY_SECOND) || defaultConfig.reconnectDelays.second,
      max: Number(import.meta.env.VITE_WS_RECONNECT_DELAY_MAX) || defaultConfig.reconnectDelays.max,
    },

    requestTracker: {
      defaultTimeout: Number(import.meta.env.VITE_WS_REQUEST_TIMEOUT) || defaultConfig.requestTracker.defaultTimeout,
      maxPendingRequests: Number(import.meta.env.VITE_WS_MAX_PENDING_REQUESTS) || defaultConfig.requestTracker.maxPendingRequests,
      cleanupInterval: Number(import.meta.env.VITE_WS_CLEANUP_INTERVAL) || defaultConfig.requestTracker.cleanupInterval,
    },
  };
}

export const wsConfig = getWebSocketConfig();

// Re-export constants for convenience
export { WEBSOCKET_CONSTANTS } from '../constants';

