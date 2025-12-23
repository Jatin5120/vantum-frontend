/**
 * SocketClient Types
 * Types specific to the low-level SocketClient
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ClientEvents extends Record<string, unknown> {
  state: ConnectionState;
  data: Uint8Array;
  error: Error;
}

export interface ConnectionWaiter {
  id: symbol;
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

