/**
 * WebSocket Types
 * Re-exports shared types and defines frontend-specific types
 */

// Re-export all shared types and constants
export {
  VOICECHAT_EVENTS,
  ErrorCode,
} from '@Jatin5120/vantum-shared';

export type {
  VoicechatEventType,
  AudioStartPayload,
  AudioChunkPayload,
  AudioEndPayload,
  ResponseStartPayload,
  ResponseChunkPayload,
  ResponseInterruptPayload,
  ResponseStopPayload,
  ResponseCompletePayload,
  ConnectionAckPayload,
  EventMessage,
  UnpackedMessage,
  ErrorMessage,
  ErrorPayload,
} from '@Jatin5120/vantum-shared';

// ============================================================================
// Client Types (Low-Level)
// ============================================================================

export type { ConnectionState, ClientEvents } from './client/types';

// ============================================================================
// Manager Types (High-Level)
// ============================================================================

/**
 * Socket Event Handler Interface
 * Handlers process incoming WebSocket messages
 */
import type { UnpackedMessage } from '@Jatin5120/vantum-shared';
import type { SocketManager } from './manager/socket-manager';

export interface SocketEventHandler {
  /**
   * Handle incoming message
   * @param data - Raw MessagePack data (for backward compatibility)
   * @param eventType - Event type string
   * @param manager - SocketManager instance for utility methods
   * @param unpackedMessage - Pre-unpacked message (optional, for optimization)
   */
  handle(
    data: Uint8Array,
    eventType: string,
    manager: SocketManager,
    unpackedMessage?: UnpackedMessage
  ): Promise<void>;
}

