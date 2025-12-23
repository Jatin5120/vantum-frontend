# SocketManager

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For WebSocket architecture, see [Client Architecture](./client-architecture.md).  
> **For protocol details, see [Backend Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)**.

## Overview

`SocketManager` is the high-level WebSocket API that provides message handling, event routing, and request/response tracking. It wraps `SocketClient` and adds MessagePack serialization, handler registry, and ACK tracking.

**Location**: `src/lib/websocket/manager/socket-manager.ts`

## Class API

```typescript
class SocketManager {
  // Connection Management
  connect(url: string): void
  disconnect(clear?: boolean): void
  isConnected(): boolean
  getState(): ConnectionState
  onStateChange(callback: (state: ConnectionState) => void): () => void
  
  // Messaging
  sendMessagePack<T>(event: EventMessage<T>): Promise<string>
  sendMessagePackWithAck<T>(event: EventMessage<T>, timeout?: number): Promise<UnpackedMessage>
  
  // Handler Management
  registerHandler(eventType: string, handler: SocketEventHandler): void
  registerErrorHandler(eventType: string, handler: SocketEventHandler): void
  unregisterHandler(eventType: string): void
  
  // Utilities
  decodeMessagePack<T>(data: Uint8Array): T
  encodeMessagePack<T>(object: T): Uint8Array
  getSessionId(): string | undefined
  destroy(): void
}
```

## Key Features

### 1. Automatic MessagePack Handling

```typescript
// Sending
await manager.sendMessagePack({
  eventType: 'voicechat.audio.start',
  eventId: '123',
  sessionId: 'session-123',
  payload: { samplingRate: 16000 },
});
// Automatically encoded to MessagePack

// Receiving
manager.on('data', (data: Uint8Array) => {
  const message = manager.decodeMessagePack(data);
  // Automatically decoded from MessagePack
});
```

### 2. ACK Tracking

```typescript
// Send with ACK tracking
const ack = await manager.sendMessagePackWithAck({
  eventType: 'voicechat.audio.start',
  eventId: '123',
  sessionId: 'session-123',
  payload: { samplingRate: 16000 },
}, 10000); // 10s timeout

console.log('ACK received:', ack);
```

**How it works**:
1. Request tracked by `eventId`
2. When ACK arrives with same `eventId` and `payload.success === true`
3. Promise resolves with ACK message
4. If timeout, promise rejects

### 3. Event Routing

```typescript
// Register handler
manager.registerHandler('voicechat.response.chunk', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Handle response chunk
  },
});

// When message arrives with eventType='voicechat.response.chunk'
// Handler is automatically called
```

### 4. Session Management

```typescript
// Session ID is extracted from CONNECTION_ACK
if (message.eventType === VOICECHAT_EVENTS.CONNECTION_ACK) {
  this.sessionId = message.sessionId;
  eventBus.emit('connectionAck', { sessionId: this.sessionId });
}

// Access session ID
const sessionId = manager.getSessionId();
```

## Methods

### connect(url)

**Purpose**: Connect to WebSocket server

**Parameters**:
- `url`: WebSocket URL (e.g., `ws://localhost:3001/ws`)

**Behavior**:
1. Calls `SocketClient.connect(url)`
2. State changes: `disconnected` → `connecting` → `connected`
3. Emits `connectionAck` event when session established

### disconnect(clear?)

**Purpose**: Disconnect from WebSocket server

**Parameters**:
- `clear`: If true, permanently close (no reconnect)

**Behavior**:
1. Closes WebSocket connection
2. Clears request tracker (rejects pending requests)
3. Clears session ID
4. State changes to `disconnected`

### sendMessagePack(event)

**Purpose**: Send MessagePack event (fire and forget)

**Parameters**:
- `event`: Event message to send

**Returns**: `Promise<string>` (eventId)

**Example**:
```typescript
const eventId = await manager.sendMessagePack({
  eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
  eventId: generateEventId(),
  sessionId: 'session-123',
  payload: { audio: chunk },
});
```

### sendMessagePackWithAck(event, timeout?)

**Purpose**: Send MessagePack event and wait for ACK

**Parameters**:
- `event`: Event message to send
- `timeout`: Timeout in milliseconds (default: 5000)

**Returns**: `Promise<UnpackedMessage>` (ACK message)

**Throws**: Error on timeout or connection loss

**Example**:
```typescript
try {
  const ack = await manager.sendMessagePackWithAck({
    eventType: VOICECHAT_EVENTS.AUDIO_START,
    eventId: '123',
    sessionId: 'session-123',
    payload: { samplingRate: 16000 },
  }, 10000);
  
  console.log('ACK:', ack);
} catch (error) {
  console.error('Timeout or error:', error);
}
```

### registerHandler(eventType, handler)

**Purpose**: Register event handler

**Parameters**:
- `eventType`: Event type to handle (e.g., `voicechat.response.chunk`)
- `handler`: Handler object with `handle()` method

**Example**:
```typescript
manager.registerHandler('voicechat.response.chunk', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Handle event
  },
});
```

### onStateChange(callback)

**Purpose**: Subscribe to connection state changes

**Parameters**:
- `callback`: Function called on state change

**Returns**: Unsubscribe function

**Example**:
```typescript
const unsubscribe = manager.onStateChange((state) => {
  console.log('State changed:', state);
});

// Later: unsubscribe
unsubscribe();
```

## Internal Components

### HandlerRegistry

Manages event handler registration and routing.

See [Handler Registry Documentation](./handler-registry.md).

### RequestTracker

Tracks pending requests and matches ACK responses.

**Key Methods**:
- `trackRequest(eventId, eventType, timeout)`: Track request
- `matchAck(eventId, ackMessage)`: Match ACK
- `clear()`: Clear all pending requests

### SocketClient

Low-level WebSocket wrapper.

**Key Methods**:
- `connect(url)`: Establish connection
- `send(data)`: Send binary data
- `on(event, handler)`: Subscribe to events

## Message Flow

### Sending Messages

```typescript
// 1. Create event
const event = {
  eventType: 'voicechat.audio.start',
  eventId: generateEventId(),
  sessionId: manager.getSessionId(),
  payload: { samplingRate: 16000 },
};

// 2. Send (with or without ACK)
const eventId = await manager.sendMessagePack(event);
// or
const ack = await manager.sendMessagePackWithAck(event, 10000);
```

### Receiving Messages

```typescript
// 1. Message arrives (binary MessagePack)
// 2. SocketManager.handleIncomingData() called
// 3. Message decoded
const message = unpack(data);

// 4. Check if ACK
if (isAck(message)) {
  requestTracker.matchAck(message.eventId, message);
  return; // ACK handled
}

// 5. Route to handler
await handlerRegistry.routeMessage(data, message.eventType, this, message);
```

## Best Practices

### 1. Check Connection Before Sending

```typescript
// ✅ GOOD
if (manager.isConnected()) {
  await manager.sendMessagePack(event);
}

// ❌ BAD
await manager.sendMessagePack(event); // May throw if not connected
```

### 2. Use ACKs for Critical Messages

```typescript
// ✅ GOOD: Use ACK for audio.start (critical)
const ack = await manager.sendMessagePackWithAck(startEvent, 10000);

// ✅ GOOD: Fire and forget for audio.chunk (high frequency)
await manager.sendMessagePack(chunkEvent);
```

### 3. Handle ACK Timeouts

```typescript
// ✅ GOOD: Handle timeout
try {
  const ack = await manager.sendMessagePackWithAck(event, 10000);
} catch (error) {
  logger.error('ACK timeout', error);
  setError('Server did not respond');
}
```

## Related Documentation

- [Client Architecture](./client-architecture.md)
- [Handler Registry](./handler-registry.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)
- [Backend Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

