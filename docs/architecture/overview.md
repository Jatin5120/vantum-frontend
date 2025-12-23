# Frontend Architecture Overview

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For WebSocket protocol details, see [Backend WebSocket Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md).  
> **For code organization, see [Folder Structure Documentation](../code/folder-structure.md)**.

## System Architecture

### Overview

Vantum frontend is a **React + TypeScript** application using **Vite** for development and build tooling. It implements a real-time voice chat interface that communicates with the backend via **WebSocket + MessagePack** protocol.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Application                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              App Component                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │           VoiceChat Component                     │  │  │
│  │  │                                                    │  │  │
│  │  │  ┌──────────────┐  ┌───────────────┐  ┌────────┐ │  │  │
│  │  │  │ useWebSocket │  │ useAudioCapture│  │useAudio│ │  │  │
│  │  │  │              │  │                │  │Playback│ │  │  │
│  │  │  └──────┬───────┘  └──────┬────────┘  └───┬────┘ │  │  │
│  │  │         │                  │                │      │  │  │
│  │  └─────────┼──────────────────┼────────────────┼──────┘  │  │
│  │            │                  │                │         │  │
│  └────────────┼──────────────────┼────────────────┼─────────┘  │
│               │                  │                │            │
└───────────────┼──────────────────┼────────────────┼────────────┘
                │                  │                │
                ▼                  ▼                ▼
    ┌───────────────────┐  ┌──────────────┐  ┌──────────────┐
    │  WebSocket Layer  │  │ AudioCapture │  │AudioPlayback │
    │                   │  │              │  │              │
    │  ┌─────────────┐  │  │ ┌──────────┐ │  │ ┌──────────┐ │
    │  │SocketManager│  │  │ │ScriptProc│ │  │ │AudioConte│ │
    │  ├─────────────┤  │  │ │essorNode │ │  │ │xt + Queue│ │
    │  │SocketClient │  │  │ └──────────┘ │  │ └──────────┘ │
    │  ├─────────────┤  │  │              │  │              │
    │  │HandlerRegist│  │  │  Int16 PCM   │  │  Float32     │
    │  ├─────────────┤  │  │  Encoding    │  │  Decoding    │
    │  │RequestTracke│  │  │              │  │              │
    │  └─────────────┘  │  └──────────────┘  └──────────────┘
    └─────────┬─────────┘
              │
              │ WebSocket (MessagePack)
              │ ws://host:port/ws
              ▼
    ┌─────────────────────┐
    │  Backend Server     │
    └─────────────────────┘
```

## Core Architectural Patterns

### 1. Component-Based Architecture

The application follows React's component-based architecture with clear separation of concerns:

- **Presentational Components**: UI rendering (e.g., `ConnectionStatus`)
- **Container Components**: Business logic (e.g., `VoiceChat`)
- **Custom Hooks**: Reusable stateful logic (e.g., `useWebSocket`, `useAudioCapture`)

### 2. Event-Driven Communication

Communication between layers uses an event-driven pattern:

```typescript
// WebSocket events flow through handler registry
SocketManager → HandlerRegistry → Event Handlers → React State Updates
```

Key components:
- **EventBus**: Pub/sub for cross-component communication
- **Handler Registry**: WebSocket event routing
- **React State**: Component state updates trigger re-renders

### 3. Separation of Concerns

#### WebSocket Layer (`src/lib/websocket/`)

**Responsibilities**:
- Connection management
- Message serialization (MessagePack)
- Event routing
- Request/response tracking

**Key Classes**:
- `SocketClient`: Low-level WebSocket connection
- `SocketManager`: High-level API
- `HandlerRegistry`: Event routing
- `RequestTracker`: ACK tracking

See [WebSocket Client Architecture](../websocket/client-architecture.md) for details.

#### Audio Layer (`src/lib/audio/`)

**Responsibilities**:
- Microphone audio capture
- Audio playback
- Format conversion (Int16 ↔ Float32)

**Key Classes**:
- `AudioCapture`: Microphone capture → Int16 PCM
- `AudioPlayback`: Audio queue → AudioContext playback

See [Audio Capture](../audio/audio-capture.md) and [Audio Playback](../audio/audio-playback.md) for details.

#### Component Layer (`src/components/`)

**Responsibilities**:
- UI rendering
- User interaction handling
- State management
- Event handler registration

**Key Components**:
- `VoiceChat`: Main application logic
- `ConnectionStatus`: Status display

See [Component Documentation](../components/VoiceChat.md) for details.

### 4. State Management Strategy

The application uses **React's built-in state management** with custom hooks:

```typescript
// State is distributed across hooks
const { connectionState, sessionId, connect, disconnect, ... } = useWebSocket();
const { isCapturing, startCapture, stopCapture, ... } = useAudioCapture();
const { playChunk, stop, getIsPlaying } = useAudioPlayback();
```

**State Categories**:

1. **Connection State**: WebSocket connection status, session ID
2. **Audio State**: Capture/playback status, permissions
3. **UI State**: Error messages, recording status

See [State Management](./state-management.md) for details.

## Data Flow

### Outgoing (Client → Server)

```
User Action (Button Click)
    ↓
Component Event Handler
    ↓
useAudioCapture Hook
    ↓
AudioCapture Class (microphone → Int16 PCM)
    ↓
Chunk Callback
    ↓
useWebSocket Hook
    ↓
SocketManager.sendMessagePack()
    ↓
MessagePack Encoding
    ↓
WebSocket → Server
```

### Incoming (Server → Client)

```
WebSocket Message
    ↓
SocketManager.handleIncomingData()
    ↓
MessagePack Decoding
    ↓
HandlerRegistry.routeMessage()
    ↓
Event Handler (in VoiceChat component)
    ↓
useAudioPlayback Hook
    ↓
AudioPlayback Class (queue → AudioContext)
    ↓
Browser Audio Output
```

## Technology Stack

### Core Technologies

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool & dev server
- **TailwindCSS**: Styling

### WebSocket & Serialization

- **WebSocket API**: Browser native WebSocket
- **msgpackr**: MessagePack serialization
- **uuid**: UUIDv7 generation

### Audio

- **Web Audio API**: AudioContext for playback
- **ScriptProcessorNode**: Audio capture (deprecated but required)
- **AudioBufferSourceNode**: Audio playback

See [Browser Compatibility](../reference/browser-compatibility.md) for browser requirements.

## Critical Design Decisions

### 1. MessagePack for Binary Serialization

**Why**: Efficient binary format for audio data

**Trade-offs**:
- ✅ Smaller message size vs JSON
- ✅ Native binary data support
- ❌ Less human-readable for debugging
- ⚠️ Requires buffer handling care (see below)

### 2. ScriptProcessorNode for Audio Capture

**Why**: Only way to get raw PCM audio data in browsers

**Trade-offs**:
- ✅ Access to raw audio samples
- ✅ Works in all major browsers
- ❌ Deprecated (no replacement yet)
- ⚠️ Performance considerations

See [Audio Capture](../audio/audio-capture.md) for details.

### 3. Custom Hooks Pattern

**Why**: Encapsulate stateful logic, promote reusability

**Benefits**:
- Separation of concerns
- Testability
- Reusability
- Composability

See [Best Practices](../development/best-practices.md) for hook patterns.

### 4. React Strict Mode Compatibility

**Why**: Ensure future React compatibility

**Challenge**: Strict Mode runs effects twice in development

**Solution**: 
- Clear handler refs on manager recreation
- Handler registration effect re-runs automatically
- No state updates in effects

See [React Strict Mode Compatibility](./react-strict-mode.md) for critical details.

## Performance Considerations

### 1. Audio Chunk Buffering

**Issue**: MessagePack may return views into shared buffer

**Solution**: Always copy audio data to independent buffer

```typescript
// CRITICAL: Create a copy
audioData = new Uint8Array(rawAudio);
```

See [Audio Playback](../audio/audio-playback.md#buffer-handling) for details.

### 2. Event Handler Memoization

**Issue**: Handler recreation causes unnecessary re-renders

**Solution**: Use `useMemo` for handler map creation

```typescript
const handlers = useMemo(() => {
  // Create handler map
}, [dependencies]);
```

### 3. Audio Queue Management

**Issue**: Multiple chunks arriving rapidly

**Solution**: Sequential playback queue with automatic processing

See [Audio Playback](../audio/audio-playback.md#queue-management) for details.

## Security Considerations

### 1. Input Validation

All incoming messages are validated:
- Type checking
- Sample rate validation
- Audio data length validation

### 2. Resource Cleanup

Proper cleanup prevents resource leaks:
- AudioContext cleanup on unmount
- WebSocket cleanup on unmount
- ScriptProcessorNode cleanup on stop

### 3. Error Boundaries

Graceful error handling:
- Try/catch in async operations
- Error states in UI
- Fallback UI components

## Scalability Considerations

### Current Architecture

- Single WebSocket connection per client
- Client-side audio processing
- Direct connection to backend

### Future Enhancements

- Connection pooling
- Reconnection with exponential backoff
- State persistence
- Offline support

## Module Dependencies

```
components/
    ├─→ hooks/ (useWebSocket, useAudioCapture, useAudioPlayback)
    └─→ lib/websocket/ (event bus, types)

hooks/
    ├─→ lib/websocket/ (SocketManager, types)
    ├─→ lib/audio/ (AudioCapture, AudioPlayback)
    └─→ lib/utils/ (logger)

lib/websocket/
    ├─→ @Jatin5120/vantum-shared (types, events)
    └─→ msgpackr (serialization)

lib/audio/
    └─→ lib/utils/ (logger)
```

## Related Documentation

- [State Management](./state-management.md)
- [React Strict Mode Compatibility](./react-strict-mode.md)
- [WebSocket Client Architecture](../websocket/client-architecture.md)
- [Audio System Architecture](../audio/audio-capture.md)
- [Component Documentation](../components/VoiceChat.md)
- [Backend Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

