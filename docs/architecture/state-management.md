# State Management

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For architecture overview, see [Architecture Overview](./overview.md).

## Overview

Vantum frontend uses **React's built-in state management** with custom hooks. No external state management library is used. State is distributed across hooks and lifted to components as needed.

## State Categories

### 1. WebSocket State

**Owner**: `useWebSocket` hook  
**Location**: `src/hooks/useWebSocket.ts`

```typescript
interface WebSocketState {
  connectionState: ConnectionState; // 'disconnected' | 'connecting' | 'connected' | 'error'
  sessionId: string | undefined;   // Server-assigned session ID
}
```

**State Flow**:
```
SocketManager → useWebSocket hook → VoiceChat component → UI
```

**Access Pattern**:
```typescript
const { connectionState, sessionId, connect, disconnect, ... } = useWebSocket({
  handlers
});
```

### 2. Audio Capture State

**Owner**: `useAudioCapture` hook  
**Location**: `src/hooks/useAudioCapture.ts`

```typescript
interface AudioCaptureState {
  isCapturing: boolean;           // Currently capturing audio
  hasPermission: boolean | null;  // Microphone permission status
}
```

**State Flow**:
```
AudioCapture class → useAudioCapture hook → VoiceChat component → UI
```

**Access Pattern**:
```typescript
const { isCapturing, hasPermission, startCapture, stopCapture } = useAudioCapture({
  sampleRate: 16000
});
```

### 3. Audio Playback State

**Owner**: `useAudioPlayback` hook  
**Location**: `src/hooks/useAudioPlayback.ts`

```typescript
interface AudioPlaybackState {
  // State is internal to AudioPlayback class
  // Exposed through methods only
}
```

**State Flow**:
```
AudioPlayback class → useAudioPlayback hook → VoiceChat component
```

**Access Pattern**:
```typescript
const { playChunk, stop, getIsPlaying } = useAudioPlayback();
```

### 4. Component UI State

**Owner**: `VoiceChat` component  
**Location**: `src/components/VoiceChat/VoiceChat.tsx`

```typescript
interface UIState {
  error: string | null;        // Error message to display
  isRecording: boolean;        // Recording indicator
}
```

**State Flow**:
```
User Action → Event Handler → setState → UI Update
```

## State Management Patterns

### 1. Custom Hooks for Reusable Logic

**Pattern**: Encapsulate stateful logic in custom hooks

```typescript
// ✅ GOOD: Hook encapsulates WebSocket complexity
function useWebSocket(options: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const managerRef = useRef<SocketManager | null>(null);
  
  // Complex logic hidden from component
  // ...
  
  return { connectionState, sessionId, connect, disconnect, ... };
}
```

**Benefits**:
- Reusability across components
- Testability (hook can be tested independently)
- Separation of concerns
- Clean component code

### 2. Refs for Non-Visual State

**Pattern**: Use refs for values that don't need to trigger re-renders

```typescript
// ✅ GOOD: Manager instance doesn't need to trigger re-render
const managerRef = useRef<SocketManager | null>(null);

// ✅ GOOD: Playback instance doesn't need to trigger re-render
const playbackRef = useRef<AudioPlayback | null>(null);
```

**When to use refs vs state**:
- **State**: Value affects UI (needs re-render)
- **Ref**: Value doesn't affect UI (no re-render needed)

### 3. Callback Memoization

**Pattern**: Use `useCallback` for stable function references

```typescript
// ✅ GOOD: Callback reference stays stable
const handleConnect = useCallback(() => {
  setError(null);
  connect();
}, [connect]);

// Used in dependency array
useEffect(() => {
  // Safe to include handleConnect in deps
}, [handleConnect]);
```

**Without memoization**:
```typescript
// ❌ BAD: New function on every render
const handleConnect = () => {
  setError(null);
  connect();
};

// Causes infinite loop
useEffect(() => {
  // handleConnect is new on every render
}, [handleConnect]);
```

### 4. Handler Map Memoization

**Pattern**: Use `useMemo` for expensive computations

```typescript
// ✅ GOOD: Handler map only recreated when dependencies change
const handlers = useMemo(() => {
  const handlerMap = new Map<string, SocketEventHandler>();
  
  handlerMap.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      // Handler implementation uses playChunk from deps
      await playChunk(audioData, sampleRate, utteranceId);
    },
  });
  
  return handlerMap;
}, [playChunk, stopPlayback]); // Only recreate if these change
```

**Why memoization matters**:
- Handler map creation is expensive (multiple closures)
- Handler reference changes trigger re-registration
- Unnecessary re-registration causes performance issues

## State Flow Diagrams

### Connection Flow

```
User clicks "Connect"
    ↓
handleConnect() called
    ↓
useWebSocket.connect() called
    ↓
SocketManager.connect() called
    ↓
SocketClient establishes connection
    ↓
State change: 'connecting' → 'connected'
    ↓
setConnectionState('connected')
    ↓
Component re-renders with new state
    ↓
UI shows "Connected" status
```

### Audio Capture Flow

```
User clicks "Start Recording"
    ↓
handleStartRecording() called
    ↓
useAudioCapture.startCapture() called
    ↓
AudioCapture.start() called
    ↓
State change: isCapturing = true
    ↓
setIsCapturing(true) in hook
    ↓
Component re-renders
    ↓
UI shows "Recording..."
    ↓
Audio chunks → callback → WebSocket
```

### Audio Playback Flow

```
WebSocket message arrives
    ↓
SocketManager.handleIncomingData()
    ↓
HandlerRegistry routes to RESPONSE_CHUNK handler
    ↓
Handler calls playChunk() from useAudioPlayback
    ↓
AudioPlayback.playChunk() adds to queue
    ↓
Queue processing starts (internal state)
    ↓
Chunks play sequentially
    ↓
No component state update (playback is internal)
```

## Event-Driven Architecture

### EventBus Pattern

The application uses a centralized event bus for cross-component communication:

```typescript
// src/lib/websocket/events/event-bus.ts
export const eventBus = {
  on(event, handler),
  emit(event, data),
  off(event, handler),
};
```

**Usage**:

```typescript
// Emit event (from handler)
eventBus.emit('responseChunk', {
  audio: audioData,
  utteranceId,
  sampleRate,
});

// Listen to event (from component)
useEffect(() => {
  const unsubscribe = eventBus.on('responseChunk', (data) => {
    console.log('Chunk received', data);
  });
  
  return unsubscribe;
}, []);
```

**Benefits**:
- Loose coupling between components
- Multiple listeners per event
- Easy to add new features
- Clean separation of concerns

## State Update Patterns

### 1. Functional Updates

**Pattern**: Use functional form for state updates based on previous state

```typescript
// ✅ GOOD: Functional update
setIsRecording(prev => !prev);

// ✅ GOOD: For async updates
setConnectionState(prevState => {
  if (prevState === 'connecting') {
    return 'connected';
  }
  return prevState;
});

// ❌ BAD: Direct state access can be stale
setIsRecording(!isRecording); // isRecording might be stale
```

### 2. Conditional Updates

**Pattern**: Only update state if value actually changed

```typescript
// ✅ GOOD: Check before updating
if (newSessionId !== sessionId) {
  setSessionId(newSessionId);
}

// Also handled by React (React batches identical updates)
setSessionId(newSessionId); // React won't re-render if same value
```

### 3. Batch Updates

React 18 automatically batches updates, but be aware:

```typescript
// All these updates are batched (single re-render)
setConnectionState('connected');
setSessionId(newSessionId);
setError(null);
```

## State Synchronization

### WebSocket State → Component State

```typescript
// useWebSocket.ts
const unsubscribeState = manager.onStateChange((state) => {
  setConnectionState(state); // Sync manager state to React state
});

const unsubscribeAck = eventBus.on('connectionAck', ({ sessionId: id }) => {
  setSessionId(id); // Sync session ID from event bus
});
```

**Pattern**: External systems update React state through callbacks/events

### Component State → WebSocket Actions

```typescript
// VoiceChat.tsx
const handleConnect = useCallback(() => {
  setError(null);        // Update UI state
  connect();             // Trigger WebSocket action
}, [connect]);
```

**Pattern**: UI actions trigger both state updates and external system actions

## State Persistence

### Current Implementation

**No state persistence** - State is lost on page refresh.

### Future Implementation

Consider adding:

```typescript
// Local storage for session recovery
useEffect(() => {
  if (sessionId) {
    localStorage.setItem('vantum_session_id', sessionId);
  }
}, [sessionId]);

// Restore on mount
useEffect(() => {
  const savedSessionId = localStorage.getItem('vantum_session_id');
  if (savedSessionId) {
    // Attempt to reconnect with saved session
  }
}, []);
```

## Performance Optimization

### 1. Avoid Unnecessary Re-renders

```typescript
// ✅ GOOD: Memoized callbacks
const handleConnect = useCallback(() => {
  connect();
}, [connect]);

// ✅ GOOD: Memoized computations
const handlers = useMemo(() => createHandlers(), [deps]);

// ❌ BAD: Inline callbacks (new reference every render)
<button onClick={() => connect()}>Connect</button>
```

### 2. Lazy Initialization

```typescript
// ✅ GOOD: Only create when needed
const playChunk = useCallback(async (data) => {
  if (!playbackRef.current) {
    playbackRef.current = new AudioPlayback(); // Lazy init
  }
  await playbackRef.current.playChunk(data);
}, []);
```

### 3. Cleanup on Unmount

```typescript
// ✅ GOOD: Always cleanup resources
useEffect(() => {
  const manager = new SocketManager();
  
  return () => {
    manager.destroy(); // Cleanup
  };
}, []);
```

## Best Practices

### 1. State Colocation

Keep state as close to where it's used as possible:

```typescript
// ✅ GOOD: Local state in component
function ConnectionStatus({ state }) {
  const [expanded, setExpanded] = useState(false); // Only used here
  // ...
}
```

### 2. Lift State When Needed

Only lift state when multiple components need it:

```typescript
// ✅ GOOD: Shared state in parent
function VoiceChat() {
  const { connectionState } = useWebSocket(); // Shared state
  
  return (
    <>
      <ConnectionStatus state={connectionState} />
      <Controls state={connectionState} />
    </>
  );
}
```

### 3. Single Source of Truth

Each piece of state should have one owner:

```typescript
// ✅ GOOD: connectionState owned by useWebSocket
const { connectionState } = useWebSocket();

// ❌ BAD: Don't duplicate state
const [localConnectionState, setLocalConnectionState] = useState(connectionState);
```

### 4. Derive, Don't Duplicate

Compute derived values instead of storing them:

```typescript
// ✅ GOOD: Derived value
const isConnected = connectionState === 'connected';

// ❌ BAD: Duplicate state
const [isConnected, setIsConnected] = useState(false);
useEffect(() => {
  setIsConnected(connectionState === 'connected');
}, [connectionState]);
```

## Testing Considerations

### State Testing

Test state changes through user interactions:

```typescript
test('connection state updates when connecting', async () => {
  const { result } = renderHook(() => useWebSocket());
  
  act(() => {
    result.current.connect();
  });
  
  await waitFor(() => {
    expect(result.current.connectionState).toBe('connected');
  });
});
```

### Cleanup Testing

Verify cleanup functions are called:

```typescript
test('cleanup destroys manager on unmount', () => {
  const { unmount } = renderHook(() => useWebSocket());
  
  // Manager is created
  expect(mockSocketManager.destroy).not.toHaveBeenCalled();
  
  unmount();
  
  // Cleanup called
  expect(mockSocketManager.destroy).toHaveBeenCalled();
});
```

## Related Documentation

- [Architecture Overview](./overview.md)
- [React Strict Mode Compatibility](./react-strict-mode.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)
- [useAudioCapture Hook](../hooks/useAudioCapture.md)
- [useAudioPlayback Hook](../hooks/useAudioPlayback.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

