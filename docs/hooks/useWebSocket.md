# useWebSocket Hook

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For WebSocket architecture, see [WebSocket Client Architecture](../websocket/client-architecture.md).  
> **For React Strict Mode details, see [React Strict Mode Compatibility](../architecture/react-strict-mode.md)**.

## Overview

`useWebSocket` is a custom React hook that provides a high-level API for WebSocket communication. It manages connection lifecycle, event handler registration, and message sending/receiving.

**Location**: `src/hooks/useWebSocket.ts`

## API

### Hook Signature

```typescript
function useWebSocket(options?: UseWebSocketOptions): UseWebSocketReturn

interface UseWebSocketOptions {
  url?: string;
  handlers?: Map<string, SocketEventHandler>;
}

interface UseWebSocketReturn {
  // State
  connectionState: ConnectionState;
  sessionId: string | undefined;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  
  // Messaging
  sendMessagePack: <T>(event: EventMessage<T>) => Promise<string>;
  sendMessagePackWithAck: <T>(event: EventMessage<T>, timeout?: number) => Promise<UnpackedMessage>;
  
  // Advanced
  registerHandler: (eventType: string, handler: SocketEventHandler) => void;
  unregisterHandler: (eventType: string) => void;
  getManager: () => SocketManager | null;
}
```

## Usage

### Basic Usage

```typescript
import { useWebSocket } from '../hooks/useWebSocket';

function MyComponent() {
  const { 
    connectionState, 
    sessionId, 
    connect, 
    disconnect 
  } = useWebSocket();
  
  return (
    <div>
      <p>Status: {connectionState}</p>
      <button onClick={connect}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

### With Event Handlers

```typescript
import { useWebSocket } from '../hooks/useWebSocket';
import { VOICECHAT_EVENTS } from '@Jatin5120/vantum-shared';

function VoiceChat() {
  // Create handlers (memoized)
  const handlers = useMemo(() => {
    const map = new Map();
    
    map.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
      handle: async (data, eventType, manager, unpackedMessage) => {
        const message = unpackedMessage || manager.decodeMessagePack(data);
        const payload = message.payload;
        
        // Handle response chunk
        await playAudio(payload.audio);
      },
    });
    
    return map;
  }, [playAudio]); // Dependencies
  
  const { connect, disconnect, connectionState } = useWebSocket({
    handlers
  });
  
  return (
    <div>
      <button onClick={connect}>Connect</button>
      {connectionState === 'connected' && (
        <button onClick={disconnect}>Disconnect</button>
      )}
    </div>
  );
}
```

### Sending Messages

```typescript
const { sendMessagePack, sendMessagePackWithAck, sessionId } = useWebSocket();

// Fire and forget (no ACK wait)
await sendMessagePack({
  eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
  eventId: generateEventId(),
  sessionId,
  payload: { audio: chunk },
});

// Wait for ACK (reliable delivery)
try {
  const ack = await sendMessagePackWithAck({
    eventType: VOICECHAT_EVENTS.AUDIO_START,
    eventId: generateEventId(),
    sessionId,
    payload: { samplingRate: 16000 },
  }, 10000); // 10s timeout
  
  console.log('ACK received:', ack);
} catch (error) {
  console.error('ACK timeout or error:', error);
}
```

## State Management

### Connection State

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
```

**State Transitions**:
```
disconnected → (connect()) → connecting → connected
connected → (disconnect()) → disconnected
connected → (error) → error
error → (connect()) → connecting
```

### Session ID

```typescript
const { sessionId } = useWebSocket();

// sessionId is undefined until CONNECTION_ACK received
if (sessionId) {
  // Can send messages
}
```

**Lifecycle**:
1. `undefined` initially
2. Set when `CONNECTION_ACK` received from server
3. Cleared on disconnect

## Event Handler Registration

### Handler Interface

```typescript
interface SocketEventHandler {
  handle(
    data: Uint8Array,           // Raw message data
    eventType: string,          // Event type
    manager: SocketManager,     // Manager instance (for utilities)
    unpackedMessage?: UnpackedMessage  // Pre-decoded message (optimization)
  ): Promise<void>;
}
```

### Handler Registration Flow

```typescript
// 1. Create handlers (useMemo for stability)
const handlers = useMemo(() => {
  const map = new Map<string, SocketEventHandler>();
  
  map.set('event.type', {
    handle: async (data, eventType, manager, unpackedMessage) => {
      // Handler implementation
    },
  });
  
  return map;
}, [dependencies]);

// 2. Pass to hook
const {} = useWebSocket({ handlers });

// 3. Hook registers handlers to SocketManager
// 4. When message arrives, handler is called automatically
```

### Handler Dependencies

**Critical**: Include all external values used in handlers as dependencies:

```typescript
// ✅ GOOD: playChunk in dependencies
const handlers = useMemo(() => {
  const map = new Map();
  
  map.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      await playChunk(audioData); // Uses playChunk from closure
    },
  });
  
  return map;
}, [playChunk]); // ← playChunk in deps

// ❌ BAD: Missing dependency
const handlers = useMemo(() => {
  // Uses playChunk but not in deps
  return map;
}, []); // ← Missing playChunk
```

## React Strict Mode Compatibility

**CRITICAL**: This hook handles React Strict Mode correctly.

### The Challenge

React Strict Mode runs effects twice in development:
1. First run: Create SocketManager A, register handlers
2. Cleanup: Destroy SocketManager A
3. Second run: Create SocketManager B, handlers NOT re-registered ❌

### The Solution

```typescript
// Manager creation effect
useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  registeredHandlersRef.current.clear(); // ← Clear tracking ref
  
  return () => manager.destroy();
}, []);

// Handler registration effect (runs after manager creation)
useEffect(() => {
  // Register handlers
  // Will re-run because registeredHandlersRef was cleared
}, [options.handlers]);
```

**See [React Strict Mode Compatibility](../architecture/react-strict-mode.md) for complete details.**

## Internal Implementation

### Manager Lifecycle

```typescript
// Create manager
const manager = new SocketManager();
managerRef.current = manager;

// Subscribe to state changes
const unsubscribeState = manager.onStateChange((state) => {
  setConnectionState(state); // Sync to React state
});

// Subscribe to session ACK
const unsubscribeAck = eventBus.on('connectionAck', ({ sessionId }) => {
  setSessionId(sessionId); // Sync to React state
});

// Cleanup
return () => {
  unsubscribeState();
  unsubscribeAck();
  manager.destroy();
};
```

### Handler Registration

```typescript
useEffect(() => {
  const manager = managerRef.current;
  const currentHandlers = registeredHandlersRef.current;
  const newHandlers = options.handlers;
  
  // Unregister removed handlers
  for (const [eventType] of currentHandlers.entries()) {
    if (!newHandlers.has(eventType)) {
      manager.unregisterHandler(eventType);
      currentHandlers.delete(eventType);
    }
  }
  
  // Register new/changed handlers
  for (const [eventType, handler] of newHandlers.entries()) {
    const existingHandler = currentHandlers.get(eventType);
    if (existingHandler !== handler) {
      manager.registerHandler(eventType, handler);
      currentHandlers.set(eventType, handler);
    }
  }
}, [options.handlers]);
```

## Best Practices

### 1. Memoize Handlers

```typescript
// ✅ GOOD: Memoized handlers
const handlers = useMemo(() => {
  const map = new Map();
  // Create handlers
  return map;
}, [dependencies]);

const {} = useWebSocket({ handlers });

// ❌ BAD: Inline handlers (recreated every render)
const {} = useWebSocket({
  handlers: new Map([...]) // New map every render!
});
```

### 2. Check Connection Before Sending

```typescript
const { isConnected, sendMessagePack, sessionId } = useWebSocket();

// ✅ GOOD: Check before sending
if (isConnected() && sessionId) {
  await sendMessagePack(event);
}

// ❌ BAD: Send without checking
await sendMessagePack(event); // May throw if not connected
```

### 3. Handle ACK Timeouts

```typescript
// ✅ GOOD: Handle timeout
try {
  const ack = await sendMessagePackWithAck(event, 10000);
  console.log('Success:', ack);
} catch (error) {
  console.error('Timeout or error:', error);
  setError('Server did not respond');
}

// ❌ BAD: No error handling
const ack = await sendMessagePackWithAck(event); // Unhandled timeout
```

### 4. Clean Dependencies

```typescript
// ✅ GOOD: Only necessary dependencies
const handlers = useMemo(() => {
  // Uses playChunk only
  return map;
}, [playChunk]);

// ❌ BAD: Unnecessary dependencies
const handlers = useMemo(() => {
  // Uses playChunk only
  return map;
}, [playChunk, connectionState, sessionId]); // Extra deps cause re-creation
```

## Common Patterns

### Pattern 1: Connection Management

```typescript
const { connectionState, connect, disconnect } = useWebSocket();

const handleConnect = useCallback(() => {
  setError(null);
  connect();
}, [connect]);

const handleDisconnect = useCallback(() => {
  if (isRecording) {
    stopRecording();
  }
  disconnect();
}, [disconnect, isRecording, stopRecording]);
```

### Pattern 2: Conditional Rendering

```typescript
const { connectionState, sessionId } = useWebSocket();

return (
  <>
    {connectionState === 'disconnected' && (
      <button onClick={connect}>Connect</button>
    )}
    
    {connectionState === 'connected' && sessionId && (
      <button onClick={startRecording}>Start Recording</button>
    )}
  </>
);
```

### Pattern 3: Event Handler with State

```typescript
const [messages, setMessages] = useState<Message[]>([]);

const handlers = useMemo(() => {
  const map = new Map();
  
  map.set('chat.message', {
    handle: async (data, eventType, manager, unpackedMessage) => {
      const message = unpackedMessage || manager.decodeMessagePack(data);
      setMessages(prev => [...prev, message.payload]); // Update state
    },
  });
  
  return map;
}, [setMessages]); // setMessages is stable (from useState)
```

## Troubleshooting

### Issue: Handlers Not Executing

**Symptoms**: "Unhandled event type" warnings

**Causes**:
1. React Strict Mode issue (handlers not re-registered)
2. Handler map not memoized (recreated every render)
3. Wrong event type

**Solutions**:
1. Verify `registeredHandlersRef.current.clear()` is called
2. Use `useMemo` for handler map
3. Check event type matches server

### Issue: Stale Closure

**Symptoms**: Handler uses old values

**Cause**: Missing dependency in `useMemo`

**Solution**:
```typescript
// ✅ GOOD: Include all dependencies
const handlers = useMemo(() => {
  map.set('event', {
    handle: async () => {
      console.log(currentValue); // Uses currentValue
    },
  });
  return map;
}, [currentValue]); // ← Include currentValue

// ❌ BAD: Missing dependency
const handlers = useMemo(() => {
  // Uses currentValue but not in deps
  return map;
}, []); // ← Missing currentValue (stale closure)
```

## Related Documentation

- [WebSocket Client Architecture](../websocket/client-architecture.md)
- [React Strict Mode Compatibility](../architecture/react-strict-mode.md)
- [State Management](../architecture/state-management.md)
- [VoiceChat Component](../components/VoiceChat.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

