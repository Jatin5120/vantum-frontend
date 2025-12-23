# WebSocket Client Architecture

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For protocol specification, see [Backend WebSocket Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md).  
> **For architecture overview, see [Architecture Overview](../architecture/overview.md)**.

## Overview

The WebSocket client is a layered architecture that provides a high-level API for WebSocket communication. It handles connection management, message serialization, event routing, and request/response tracking.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│              React Component Layer                       │
│  (VoiceChat component, custom hooks)                    │
└────────────────────┬────────────────────────────────────┘
                     │ useWebSocket() hook
                     ▼
┌─────────────────────────────────────────────────────────┐
│              SocketManager                              │
│  High-level API: connect(), sendMessagePack(), etc.    │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ HandlerRegistry  │  │   RequestTracker          │  │
│  │ Event routing    │  │   ACK tracking            │  │
│  └──────────────────┘  └───────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              SocketClient                               │
│  Low-level WebSocket: send(), on(), connect()          │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │ EventEmitter     │  │  NetworkMonitor           │  │
│  │ Event system     │  │  Connection health        │  │
│  └──────────────────┘  └───────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Browser WebSocket API                        │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. SocketClient

**Location**: `src/lib/websocket/client/socket-client.ts`

**Purpose**: Low-level WebSocket wrapper

**Responsibilities**:
- WebSocket connection lifecycle
- Message sending/receiving
- Error handling
- Event emission
- Connection health monitoring

**Key Methods**:
```typescript
class SocketClient {
  connect(url: string): void
  disconnect(clear?: boolean): void
  send(data: Uint8Array): Promise<void>
  on(event: string, handler: Function): void
  isConnected(): boolean
  destroy(): void
}
```

**Events Emitted**:
- `state`: Connection state changes
- `data`: Incoming binary messages
- `error`: Connection errors

### 2. SocketManager

**Location**: `src/lib/websocket/manager/socket-manager.ts`

**Purpose**: High-level WebSocket API with message handling

**Responsibilities**:
- Message serialization (MessagePack)
- Event routing via HandlerRegistry
- Request/response tracking
- Session management
- State synchronization

**Key Methods**:
```typescript
class SocketManager {
  // Connection
  connect(url: string): void
  disconnect(clear?: boolean): void
  isConnected(): boolean
  
  // Messaging
  sendMessagePack<T>(event: EventMessage<T>): Promise<string>
  sendMessagePackWithAck<T>(event: EventMessage<T>, timeout?: number): Promise<UnpackedMessage>
  
  // Handler management
  registerHandler(eventType: string, handler: SocketEventHandler): void
  unregisterHandler(eventType: string): void
  
  // Utilities
  decodeMessagePack<T>(data: Uint8Array): T
  encodeMessagePack<T>(object: T): Uint8Array
  getSessionId(): string | undefined
  onStateChange(callback: (state: ConnectionState) => void): () => void
}
```

**Key Features**:
- Automatic MessagePack encoding/decoding
- ACK tracking for reliable message delivery
- Handler registry integration
- Session ID management

### 3. HandlerRegistry

**Location**: `src/lib/websocket/manager/handler-registry.ts`

**Purpose**: Event handler registration and routing

**Responsibilities**:
- Handler registration
- Event type matching
- Error event routing
- Handler lifecycle management

**Key Methods**:
```typescript
class HandlerRegistry {
  registerHandler(eventType: string, handler: SocketEventHandler): void
  registerErrorHandler(eventType: string, handler: SocketEventHandler): void
  unregisterHandler(eventType: string): void
  routeMessage(data: Uint8Array, eventType: string, manager: SocketManager, unpackedMessage?: UnpackedMessage): Promise<boolean>
  getRegisteredEventTypes(): string[]
}
```

**Handler Interface**:
```typescript
interface SocketEventHandler {
  handle(
    data: Uint8Array,           // Raw message data
    eventType: string,          // Event type
    manager: SocketManager,     // Manager instance
    unpackedMessage?: UnpackedMessage  // Pre-decoded message (optimization)
  ): Promise<void>;
}
```

**Event Routing**:
```typescript
// 1. Regular events
VOICECHAT_EVENTS.RESPONSE_CHUNK → handler.handle()

// 2. Error events (ending with .error)
VOICECHAT_EVENTS.AUDIO_ERROR → errorHandler.handle()
                             → OR fallback to 'error' wildcard handler
```

### 4. RequestTracker

**Location**: `src/lib/websocket/manager/request-tracker.ts`

**Purpose**: Track requests and match with ACK responses

**Responsibilities**:
- Track pending requests by eventId
- Match ACK responses
- Timeout handling
- Promise resolution/rejection

**Key Methods**:
```typescript
class RequestTracker {
  trackRequest(eventId: string, eventType: string, timeout?: number): Promise<UnpackedMessage>
  matchAck(eventId: string, ackMessage: UnpackedMessage): boolean
  clear(): void
  destroy(): void
}
```

**ACK Matching Logic**:
```typescript
// ACK must have:
// 1. Same eventId as request
// 2. payload.success === true
if (message.eventId === requestEventId && message.payload.success === true) {
  // Match! Resolve promise
}
```

## Message Flow

### Outgoing Message Flow

```typescript
// 1. Component calls hook method
await sendMessagePackWithAck({
  eventType: VOICECHAT_EVENTS.AUDIO_START,
  eventId: '019b4c0b-8067-75f8',
  sessionId: 'session-123',
  payload: { samplingRate: 16000 }
}, 10000); // 10s timeout

// 2. SocketManager tracks request
const ackPromise = requestTracker.trackRequest(eventId, eventType, timeout);

// 3. SocketManager encodes and sends
const data = pack(event); // MessagePack encoding
await socketClient.send(data);

// 4. Wait for ACK (promise resolves when matched)
const ack = await ackPromise;
```

### Incoming Message Flow

```typescript
// 1. WebSocket receives binary data
socketClient.on('data', (data: Uint8Array) => {
  socketManager.handleIncomingData(data);
});

// 2. SocketManager decodes message
const message = unpack(data) as UnpackedMessage;

// 3. Check if it's an ACK
if (message.eventId && message.payload.success === true) {
  const matched = requestTracker.matchAck(message.eventId, message);
  if (matched) return; // ACK handled, done
}

// 4. Route to handler
const handled = await handlerRegistry.routeMessage(
  data,
  message.eventType,
  this,
  message // Pass pre-decoded message (optimization)
);

// 5. Handler executes
handler.handle(data, eventType, manager, message);
```

## Handler Registration

### Registration Flow

```typescript
// 1. Component creates handlers (useMemo)
const handlers = useMemo(() => {
  const map = new Map();
  map.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      // Handle response chunk
    },
  });
  return map;
}, [dependencies]);

// 2. Hook passes handlers to SocketManager
const {} = useWebSocket({ handlers });

// 3. Effect registers handlers
useEffect(() => {
  for (const [eventType, handler] of handlers.entries()) {
    manager.registerHandler(eventType, handler);
  }
}, [handlers]);

// 4. Messages routed to handlers
// When message arrives, HandlerRegistry finds and calls handler
```

### React Strict Mode Handling

**CRITICAL**: Special handling required for React Strict Mode.

See [React Strict Mode Compatibility](../architecture/react-strict-mode.md) for complete details.

**Summary**:
1. Manager created/destroyed twice in development
2. Handler registration ref cleared on manager recreation
3. Handlers automatically re-registered to new manager
4. No state updates in effects

## Event Bus Integration

The WebSocket layer integrates with the global event bus:

```typescript
// SocketManager emits high-level events
if (message.eventType === VOICECHAT_EVENTS.CONNECTION_ACK) {
  this.sessionId = message.sessionId;
  eventBus.emit('connectionAck', { sessionId: this.sessionId });
}

// Handlers can also emit events
eventBus.emit('responseChunk', {
  audio: audioData,
  utteranceId,
  sampleRate,
});

// Components listen to events
useEffect(() => {
  return eventBus.on('responseChunk', (data) => {
    // Handle event
  });
}, []);
```

**Benefits**:
- Loose coupling
- Multiple listeners
- Cross-component communication

## Error Handling

### Connection Errors

```typescript
// SocketClient emits error events
socketClient.on('error', (error) => {
  logger.error('WebSocket error', error);
  setConnectionState('error');
});
```

### Message Handling Errors

```typescript
// Handlers catch errors
try {
  await handler.handle(data, eventType, manager, message);
} catch (error) {
  logger.error(`Error in handler for ${eventType}`, error);
  // Handler error doesn't crash app
}
```

### ACK Timeout Errors

```typescript
// RequestTracker handles timeouts
try {
  const ack = await sendMessagePackWithAck(event, 10000);
} catch (error) {
  // Timeout or other error
  logger.error('ACK timeout', error);
  setError('Server did not respond');
}
```

## Performance Optimizations

### 1. Pre-decoded Message Passing

Avoid decoding messages twice:

```typescript
// SocketManager decodes once
const message = unpack(data);

// Passes pre-decoded message to handler
await handlerRegistry.routeMessage(data, message.eventType, this, message);
                                                                    ↑
// Handler can use pre-decoded message (no need to decode again)
const message = unpackedMessage || manager.decodeMessagePack(data);
```

### 2. Handler Reference Stability

Use `useMemo` to keep handler references stable:

```typescript
const handlers = useMemo(() => {
  // Only recreate if dependencies change
}, [playChunk, stopPlayback]);
```

Prevents unnecessary handler re-registration.

### 3. Message Batching

Multiple messages can be sent without waiting for ACKs:

```typescript
// Fire and forget (no ACK wait)
await sendMessagePack(event1);
await sendMessagePack(event2);
await sendMessagePack(event3);

// vs waiting for each ACK (slower)
await sendMessagePackWithAck(event1);
await sendMessagePackWithAck(event2);
await sendMessagePackWithAck(event3);
```

## State Synchronization

### SocketClient State → SocketManager

```typescript
// SocketClient state changes
this.client.on('state', (state) => {
  this.connectionState = state;
  this.stateChangeCallbacks.forEach(callback => callback(state));
});
```

### SocketManager State → React Component

```typescript
// useWebSocket hook syncs to React state
const unsubscribeState = manager.onStateChange((state) => {
  setConnectionState(state);
});
```

### React State → UI

```typescript
// Component renders based on state
{connectionState === 'connected' && (
  <button onClick={handleStartRecording}>Start Recording</button>
)}
```

## Connection Lifecycle

### Connection Sequence

```
1. User clicks "Connect"
2. handleConnect() called
3. manager.connect(url) called
4. socketClient.connect(url) called
5. WebSocket connection established
6. State: 'connecting' → 'connected'
7. Server sends CONNECTION_ACK
8. sessionId stored in manager
9. connectionAck event emitted
10. sessionId synced to component
11. UI updates to show "Connected"
```

### Disconnection Sequence

```
1. User clicks "Disconnect" OR connection lost
2. manager.disconnect() called
3. socketClient.disconnect() called
4. WebSocket connection closed
5. RequestTracker cleared (pending requests rejected)
6. State: 'connected' → 'disconnected'
7. sessionId cleared
8. UI updates to show "Disconnected"
```

## Configuration

### WebSocket URL

```typescript
// Environment variable (default: ws://localhost:3001/ws)
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
```

### Timeouts

```typescript
// Connection timeout
const CONNECTION_TIMEOUT = 10000; // 10 seconds

// ACK timeout (configurable per request)
const ack = await sendMessagePackWithAck(event, 10000); // 10s timeout
```

### Reconnection

Currently: Manual reconnection (user clicks "Connect")

Future: Automatic reconnection with exponential backoff

## Security Considerations

### 1. Message Validation

All incoming messages are validated:

```typescript
// Type validation
if (!message.eventType || typeof message.eventType !== 'string') {
  logger.warn('Invalid message structure');
  return;
}

// Payload validation
if (!isResponseChunkPayload(payload)) {
  logger.error('Invalid payload structure');
  return;
}
```

### 2. Safe Send Operations

WebSocket send wrapped in try/catch:

```typescript
async send(data: Uint8Array): Promise<void> {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  
  try {
    this.ws.send(data);
  } catch (error) {
    logger.error('Failed to send message', error);
    throw error;
  }
}
```

### 3. Resource Cleanup

Proper cleanup prevents memory leaks:

```typescript
destroy(): void {
  this.disconnect(true);
  this.handlerRegistry.clear();
  this.requestTracker.destroy();
  this.client.destroy();
}
```

## Extensibility

### Adding New Event Handlers

```typescript
// 1. Define handler in component
const handlers = useMemo(() => {
  const map = new Map();
  
  map.set('my.custom.event', {
    handle: async (data, eventType, manager, unpackedMessage) => {
      // Handle custom event
    },
  });
  
  return map;
}, [dependencies]);

// 2. Pass to useWebSocket
const {} = useWebSocket({ handlers });

// 3. Handler automatically registered and called when event arrives
```

### Adding New Manager Methods

```typescript
// SocketManager extension
class SocketManager {
  // Existing methods...
  
  // New method
  sendCustomMessage(payload: CustomPayload): Promise<void> {
    return this.sendMessagePack({
      eventType: 'custom.event',
      eventId: generateEventId(),
      sessionId: this.sessionId,
      payload,
    });
  }
}
```

## Testing Strategy

### Unit Testing

Test individual components in isolation:

```typescript
// Test SocketClient
describe('SocketClient', () => {
  it('emits state change events', () => {
    const client = new SocketClient();
    const handler = jest.fn();
    client.on('state', handler);
    
    client.connect('ws://test');
    
    expect(handler).toHaveBeenCalledWith('connecting');
  });
});
```

### Integration Testing

Test component integration with hooks:

```typescript
describe('VoiceChat', () => {
  it('connects to WebSocket when Connect clicked', async () => {
    render(<VoiceChat />);
    
    const connectButton = screen.getByText('Connect');
    await userEvent.click(connectButton);
    
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });
});
```

## Related Documentation

- [SocketManager Details](./socket-manager.md)
- [Handler Registry Details](./handler-registry.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)
- [React Strict Mode Compatibility](../architecture/react-strict-mode.md)
- [Backend WebSocket Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

