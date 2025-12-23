# Handler Registry

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For WebSocket architecture, see [Client Architecture](./client-architecture.md).

## Overview

`HandlerRegistry` manages event handler registration and routing. It maintains a map of event types to handlers and routes incoming messages to the appropriate handler.

**Location**: `src/lib/websocket/manager/handler-registry.ts`

## Class API

```typescript
class HandlerRegistry {
  registerHandler(eventType: string, handler: SocketEventHandler): void
  registerErrorHandler(eventType: string, handler: SocketEventHandler): void
  unregisterHandler(eventType: string): void
  getHandler(eventType: string): SocketEventHandler | undefined
  getErrorHandler(eventType: string): SocketEventHandler | undefined
  routeMessage(data: Uint8Array, eventType: string, manager: SocketManager, unpackedMessage?: UnpackedMessage): Promise<boolean>
  clear(): void
  getRegisteredEventTypes(): string[]
}
```

## Handler Interface

```typescript
interface SocketEventHandler {
  handle(
    data: Uint8Array,              // Raw message data
    eventType: string,             // Event type
    manager: SocketManager,        // Manager instance
    unpackedMessage?: UnpackedMessage  // Pre-decoded message (optimization)
  ): Promise<void>;
}
```

## Event Routing

### Regular Events

```typescript
// Handler registered for specific event type
registry.registerHandler('voicechat.response.chunk', handler);

// When message arrives with eventType='voicechat.response.chunk'
await registry.routeMessage(data, 'voicechat.response.chunk', manager, message);
// → Calls handler.handle(data, eventType, manager, message)
```

### Error Events

Error events (ending with `.error`) have special routing:

```typescript
// 1. Try error handler registry
registry.registerErrorHandler('voicechat.audio', errorHandler);
// Handles: voicechat.audio.error

// 2. Fallback to wildcard 'error' handler
registry.registerHandler('error', wildcardErrorHandler);
// Handles: any *.error event
```

**Example**:
```typescript
// Register error handler
registry.registerErrorHandler('voicechat.audio', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Handles voicechat.audio.error
  },
});

// Register wildcard error handler
registry.registerHandler('error', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Handles all *.error events not caught by specific handlers
  },
});
```

## Methods

### registerHandler(eventType, handler)

**Purpose**: Register handler for event type

**Parameters**:
- `eventType`: Event type string
- `handler`: Handler object

**Behavior**: Adds handler to registry (replaces if exists)

**Example**:
```typescript
registry.registerHandler('voicechat.response.chunk', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    console.log('Chunk received');
  },
});
```

### registerErrorHandler(eventType, handler)

**Purpose**: Register error handler for base event type

**Parameters**:
- `eventType`: Base event type (without `.error` suffix)
- `handler`: Handler object

**Behavior**: Handles `{eventType}.error` events

**Example**:
```typescript
// Handles 'voicechat.audio.error'
registry.registerErrorHandler('voicechat.audio', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    console.log('Audio error');
  },
});
```

### routeMessage(data, eventType, manager, unpackedMessage?)

**Purpose**: Route message to appropriate handler

**Parameters**:
- `data`: Raw message data (Uint8Array)
- `eventType`: Event type from message
- `manager`: SocketManager instance
- `unpackedMessage`: Pre-decoded message (optional, optimization)

**Returns**: `Promise<boolean>` (true if handled, false if no handler)

**Behavior**:
1. Check if error event (ends with `.error`)
2. Try error handler registry
3. Try wildcard `error` handler
4. Try regular handler
5. Return true if handled, false otherwise

**Example**:
```typescript
const handled = await registry.routeMessage(
  data,
  'voicechat.response.chunk',
  manager,
  message
);

if (!handled) {
  logger.warn('Unhandled event type');
}
```

### getRegisteredEventTypes()

**Purpose**: Get list of registered event types

**Returns**: `string[]`

**Example**:
```typescript
const eventTypes = registry.getRegisteredEventTypes();
console.log('Registered:', eventTypes);
// ['voicechat.response.start', 'voicechat.response.chunk', ...]
```

## Handler Implementation

### Basic Handler

```typescript
const handler: SocketEventHandler = {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Decode message (use pre-decoded if available)
    const message = unpackedMessage || manager.decodeMessagePack(data);
    const payload = message.payload;
    
    // Process payload
    console.log('Event received:', eventType, payload);
  },
};

registry.registerHandler('my.event', handler);
```

### Handler with State Updates

```typescript
const handler: SocketEventHandler = {
  handle: async (data, eventType, manager, unpackedMessage) => {
    const message = unpackedMessage || manager.decodeMessagePack(data);
    const payload = message.payload as MyPayload;
    
    // Update React state
    setMyState(payload.value);
    
    // Emit event
    eventBus.emit('myEvent', payload);
  },
};
```

### Error Handler

```typescript
const errorHandler: SocketEventHandler = {
  handle: async (data, eventType, manager, unpackedMessage) => {
    const message = unpackedMessage || manager.decodeMessagePack(data);
    const payload = message.payload as ErrorPayload;
    
    logger.error('Error event', { eventType, payload });
    setError(payload.message);
  },
};

// Handles 'voicechat.audio.error'
registry.registerErrorHandler('voicechat.audio', errorHandler);

// Or wildcard for all errors
registry.registerHandler('error', errorHandler);
```

## Pre-decoded Message Optimization

To avoid decoding messages twice, `SocketManager` passes the pre-decoded message to handlers:

```typescript
// In SocketManager.handleIncomingData()
const message = unpack(data); // Decode once

// Pass to handler
await handlerRegistry.routeMessage(data, message.eventType, this, message);
                                                                    ↑
// Handler can use pre-decoded message
const handler: SocketEventHandler = {
  handle: async (data, eventType, manager, unpackedMessage) => {
    // Use pre-decoded message (no need to decode again)
    const message = unpackedMessage || manager.decodeMessagePack(data);
    //              ↑ Use this if available
  },
};
```

**Benefits**:
- Avoid duplicate decoding
- Better performance
- Cleaner code

## Error Handling

### Handler Errors

Errors in handlers are caught and logged:

```typescript
try {
  await handler.handle(data, eventType, manager, unpackedMessage);
  return true;
} catch (error) {
  logger.error(`Error in handler for ${eventType}`, error);
  return false;
}
```

**Behavior**: Handler error doesn't crash app or stop other handlers.

### Unhandled Events

```typescript
const handled = await registry.routeMessage(...);

if (!handled) {
  logger.warn('Unhandled event type', { 
    eventType,
    registeredHandlers: registry.getRegisteredEventTypes()
  });
}
```

**Behavior**: Unhandled events are logged but don't cause errors.

## Best Practices

### 1. Register All Expected Events

```typescript
// ✅ GOOD: Register handler for expected event
registry.registerHandler('connection.ack', {
  handle: async () => {
    // Even if handled internally, register to avoid warnings
  },
});

// ❌ BAD: Don't register, get warnings
// "Unhandled event type: connection.ack"
```

### 2. Use Pre-decoded Message

```typescript
// ✅ GOOD: Use pre-decoded message
const message = unpackedMessage || manager.decodeMessagePack(data);

// ❌ BAD: Always decode (wasteful)
const message = manager.decodeMessagePack(data);
```

### 3. Handle Errors in Handlers

```typescript
// ✅ GOOD: Try/catch in handler
handle: async (data, eventType, manager, unpackedMessage) => {
  try {
    // Process message
  } catch (error) {
    logger.error('Handler error', error);
    // Don't throw (would be caught by registry anyway)
  }
}
```

### 4. Clean Up on Destroy

```typescript
// ✅ GOOD: Clear registry when done
manager.destroy(); // Calls registry.clear()
```

## Related Documentation

- [Client Architecture](./client-architecture.md)
- [SocketManager](./socket-manager.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)
- [React Strict Mode](../architecture/react-strict-mode.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

