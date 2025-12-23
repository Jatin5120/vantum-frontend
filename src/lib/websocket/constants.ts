/**
 * WebSocket Constants
 * Centralized WebSocket-related constants
 */

export const WEBSOCKET_CONSTANTS = {
  // Event types (re-exported from shared for convenience)
  // Use VOICECHAT_EVENTS from @Jatin5120/vantum-shared instead

  // Connection close codes
  CLOSE_CODES: {
    NORMAL: 1000,
    ABNORMAL: 1006,
  },

  // Network monitor
  NETWORK_MONITOR: {
    DEBOUNCE_DELAY: 500, // 500ms
  },
} as const;

