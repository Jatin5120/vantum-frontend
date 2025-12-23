/**
 * useWebSocket Hook
 * React hook for managing WebSocket connection via SocketManager
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SocketManager } from '../lib/websocket/manager/socket-manager';
import type { ConnectionState, SocketEventHandler } from '../lib/websocket/types';
import { type EventMessage, type UnpackedMessage, eventBus } from '../lib/websocket';
import { logger } from '../lib/utils/logger';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export interface UseWebSocketOptions {
  url?: string;
  handlers?: Map<string, SocketEventHandler>;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const url = options.url || WS_URL;
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const managerRef = useRef<SocketManager | null>(null);

  // Register/update handlers ref
  const registeredHandlersRef = useRef<Map<string, SocketEventHandler>>(new Map());
  
  // Initialize manager and register handlers
  // IMPORTANT: React Strict Mode runs effects twice in development, creating multiple manager instances.
  // We handle this by clearing the handlers ref on each manager creation and registering handlers
  // in a separate effect that runs after the manager is ready.
  useEffect(() => {
    const manager = new SocketManager();
    managerRef.current = manager;
    registeredHandlersRef.current.clear(); // Clear handlers ref for new manager

    // Track state changes
    const unsubscribeState = manager.onStateChange((state) => {
      setConnectionState(state);
      if (state === 'disconnected' || state === 'error') {
        setSessionId(undefined);
      }
    });

    // Track session acknowledgment from manager
    const unsubscribeAck = eventBus.on('connectionAck', ({ sessionId: id }) => {
      logger.debug('Session ID received in useWebSocket hook', { sessionId: id });
      setSessionId(id);
    });

    return () => {
      unsubscribeState();
      unsubscribeAck();
      manager.destroy();
    };
  }, []); // Only run once on mount
  
  // Register/update handlers when they change
  // This runs after manager initialization and whenever handlers change
  useEffect(() => {
    if (!managerRef.current) {
      logger.error('No SocketManager reference when attempting to register handlers');
      return;
    }

    const manager = managerRef.current;
    const currentHandlers = registeredHandlersRef.current;
    const newHandlers = options.handlers;

    // If no handlers provided, skip registration (but don't unregister existing ones)
    if (!newHandlers) {
      return;
    }

    // Unregister handlers that are no longer in the new handlers map
    for (const [eventType] of currentHandlers.entries()) {
      if (!newHandlers.has(eventType)) {
        manager.unregisterHandler(eventType);
        currentHandlers.delete(eventType);
      }
    }

    // Register or update handlers
    for (const [eventType, handler] of newHandlers.entries()) {
      const existingHandler = currentHandlers.get(eventType);
      // Only register/update if handler changed (reference comparison)
      if (existingHandler !== handler) {
        manager.registerHandler(eventType, handler);
        currentHandlers.set(eventType, handler);
        logger.debug('Handler registered', { eventType });
      }
    }
    
    logger.debug('Handler registration complete', { 
      registeredCount: currentHandlers.size,
      eventTypes: Array.from(currentHandlers.keys())
    });
  }, [options.handlers]); // Re-run when handlers change

  const connect = useCallback(() => {
    managerRef.current?.connect(url);
  }, [url]);

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  const sendMessagePack = useCallback(async <T = unknown>(event: EventMessage<T>): Promise<string> => {
    if (managerRef.current) {
      return await managerRef.current.sendMessagePack(event);
    }
    throw new Error('SocketManager not initialized');
  }, []);

  const sendMessagePackWithAck = useCallback(async <T = unknown>(event: EventMessage<T>, timeout?: number): Promise<UnpackedMessage> => {
    if (managerRef.current) {
      return await managerRef.current.sendMessagePackWithAck(event, timeout);
    }
    throw new Error('SocketManager not initialized');
  }, []);

  const isConnected = useCallback((): boolean => {
    return managerRef.current?.isConnected() ?? false;
  }, []);

  const registerHandler = useCallback((eventType: string, handler: SocketEventHandler) => {
    managerRef.current?.registerHandler(eventType, handler);
  }, []);

  const unregisterHandler = useCallback((eventType: string) => {
    managerRef.current?.unregisterHandler(eventType);
  }, []);

  // Get manager (for advanced use cases, accessed via callback to avoid ref access during render)
  const getManager = useCallback((): SocketManager | null => {
    return managerRef.current;
  }, []);

  return {
    connectionState,
    sessionId,
    connect,
    disconnect,
    sendMessagePack,
    sendMessagePackWithAck,
    isConnected,
    registerHandler,
    unregisterHandler,
    getManager,
  };
}

