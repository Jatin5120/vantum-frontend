# VoiceChat Component

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For architecture overview, see [Architecture Overview](../architecture/overview.md).

## Overview

`VoiceChat` is the main application component that orchestrates WebSocket communication, audio capture, and audio playback for real-time voice chat.

**Location**: `src/components/VoiceChat/VoiceChat.tsx`

## Component Structure

```typescript
export function VoiceChat() {
  // State
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Hooks
  const { playChunk, stop: stopPlayback } = useAudioPlayback();
  const handlers = useMemo(() => createHandlers(), [playChunk, stopPlayback]);
  const { connectionState, sessionId, connect, disconnect, ... } = useWebSocket({ handlers });
  const { isCapturing, hasPermission, startCapture, stopCapture } = useAudioCapture({ sampleRate: 16000 });
  
  // Event handlers
  const handleConnect = useCallback(() => { /* ... */ }, []);
  const handleStartRecording = useCallback(async () => { /* ... */ }, []);
  const handleStopRecording = useCallback(async () => { /* ... */ }, []);
  
  // Render
  return (
    <div>
      <ConnectionStatus state={connectionState} error={error} />
      {/* Controls */}
    </div>
  );
}
```

## State Management

### Component State

```typescript
interface ComponentState {
  error: string | null;        // Error message to display
  isRecording: boolean;        // Recording indicator
}
```

### Hook State

```typescript
// From useWebSocket
connectionState: ConnectionState  // 'disconnected' | 'connecting' | 'connected' | 'error'
sessionId: string | undefined     // Server-assigned session ID

// From useAudioCapture
isCapturing: boolean              // Currently capturing audio
hasPermission: boolean | null     // Microphone permission

// From useAudioPlayback
// No exposed state (internal to AudioPlayback class)
```

## Event Handlers

### WebSocket Event Handlers

Created with `useMemo` for stability:

```typescript
const handlers = useMemo(() => {
  const handlerMap = new Map<string, SocketEventHandler>();
  
  // CONNECTION_ACK handler
  handlerMap.set(VOICECHAT_EVENTS.CONNECTION_ACK, {
    handle: async () => {
      // Handled internally by SocketManager
    },
  });
  
  // RESPONSE_START handler
  handlerMap.set(VOICECHAT_EVENTS.RESPONSE_START, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      const message = unpackedMessage || manager.decodeMessagePack(data);
      const payload = message.payload as ResponseStartPayload;
      
      stopPlayback(); // Stop any current playback
      logger.info('Response started', { utteranceId: payload.utteranceId });
      eventBus.emit('responseStart', payload);
    },
  });
  
  // RESPONSE_CHUNK handler
  handlerMap.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      const message = unpackedMessage || manager.decodeMessagePack(data);
      const payload = message.payload as ResponseChunkPayload;
      
      // Validate and sanitize
      let sampleRate = payload.sampleRate;
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        sampleRate = AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE;
      }
      
      // CRITICAL: Copy audio data (MessagePack buffer issue)
      let audioData: Uint8Array;
      const rawAudio = payload.audio as unknown;
      if (rawAudio instanceof Uint8Array) {
        audioData = new Uint8Array(rawAudio); // Create copy
      } else if (ArrayBuffer.isView(rawAudio)) {
        const view = rawAudio as ArrayBufferView;
        audioData = new Uint8Array(
          view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
        );
      } else {
        logger.error('Invalid audio data type');
        return;
      }
      
      // Play audio
      playChunk(audioData, sampleRate, payload.utteranceId).catch(err => {
        logger.error('Error playing audio chunk', err);
        setError('Failed to play audio');
      });
      
      eventBus.emit('responseChunk', { audio: audioData, utteranceId, sampleRate });
    },
  });
  
  // RESPONSE_COMPLETE, RESPONSE_INTERRUPT, RESPONSE_STOP handlers...
  // Error handler...
  
  return handlerMap;
}, [playChunk, stopPlayback]);
```

**Dependencies**: `playChunk`, `stopPlayback` - handlers use these from closure

### User Interaction Handlers

#### handleConnect

```typescript
const handleConnect = useCallback(() => {
  setError(null);
  connect();
}, [connect]);
```

**Purpose**: Connect to WebSocket server

#### handleDisconnect

```typescript
const handleDisconnect = useCallback(() => {
  if (isRecording) {
    handleStopRecording();
  }
  disconnect();
}, [disconnect, isRecording, handleStopRecording]);
```

**Purpose**: Disconnect from server (stops recording first if active)

#### handleStartRecording

```typescript
const handleStartRecording = useCallback(async () => {
  if (!isConnected()) {
    setError('Not connected to server');
    return;
  }
  
  if (!sessionId) {
    setError('Session ID not available');
    return;
  }
  
  try {
    setError(null);
    
    // Send audio.start with ACK
    const { eventId } = packAudioStart({ samplingRate: 16000 }, sessionId);
    const ack = await sendMessagePackWithAck({
      eventType: VOICECHAT_EVENTS.AUDIO_START,
      eventId,
      sessionId,
      payload: { samplingRate: 16000 },
    }, 10000);
    
    logger.info('Audio start ACK received', { eventId: ack.eventId });
    
    // Start audio capture
    await startCapture(async (chunk) => {
      if (isConnected() && sessionId) {
        const { eventId } = packAudioChunk({ audio: chunk, isMuted: false }, sessionId);
        await sendMessagePack({
          eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
          eventId,
          sessionId,
          payload: { audio: chunk, isMuted: false },
        });
      }
    });
    
    setIsRecording(true);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
    setError(errorMessage);
    logger.error('Error starting recording', err);
  }
}, [isConnected, sendMessagePack, sendMessagePackWithAck, startCapture, sessionId]);
```

**Purpose**: Start audio recording and streaming

**Flow**:
1. Validate connection and session
2. Send `audio.start` event with ACK
3. Wait for ACK (reliable delivery)
4. Start audio capture with chunk callback
5. Stream chunks via WebSocket

#### handleStopRecording

```typescript
const handleStopRecording = useCallback(async () => {
  if (isCapturing) {
    stopCapture();
    setIsRecording(false);
    
    // Send audio.end with ACK
    if (isConnected() && sessionId) {
      const { eventId } = packAudioEnd(sessionId);
      try {
        const ack = await sendMessagePackWithAck({
          eventType: VOICECHAT_EVENTS.AUDIO_END,
          eventId,
          sessionId,
          payload: {},
        }, 10000);
        
        logger.info('Audio end ACK received', { eventId: ack.eventId });
      } catch (err) {
        logger.error('Error sending audio.end', err);
        setError('Failed to send audio.end');
      }
    }
  }
}, [isCapturing, stopCapture, isConnected, sendMessagePackWithAck, sessionId]);
```

**Purpose**: Stop audio recording

**Flow**:
1. Stop audio capture
2. Update UI state
3. Send `audio.end` event with ACK
4. Wait for ACK confirmation

## UI Structure

```tsx
<div className="min-h-screen flex flex-col items-center justify-center">
  <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
    {/* Header */}
    <h1>Vantum Voice Chat</h1>
    
    {/* Connection Status */}
    <ConnectionStatus state={connectionState} error={error} />
    
    {/* Session Info */}
    {sessionId && <div>Session: {sessionId}</div>}
    
    {/* Permission Warning */}
    {hasPermission === false && (
      <div className="warning">Microphone permission denied</div>
    )}
    
    {/* Error Display */}
    {error && <div className="error">{error}</div>}
    
    {/* Connection Controls */}
    {connectionState === 'disconnected' ? (
      <button onClick={handleConnect}>Connect</button>
    ) : (
      <button onClick={handleDisconnect}>Disconnect</button>
    )}
    
    {/* Recording Controls */}
    {connectionState === 'connected' && (
      !isRecording ? (
        <button onClick={handleStartRecording} disabled={!sessionId}>
          Start Recording
        </button>
      ) : (
        <button onClick={handleStopRecording}>
          Stop Recording
        </button>
      )
    )}
    
    {/* Status Info */}
    <div>
      <div>Connection: {connectionState}</div>
      {isRecording && <div>Recording...</div>}
    </div>
  </div>
</div>
```

## Data Flow

### Outgoing (Recording)

```
User clicks "Start Recording"
    ↓
handleStartRecording()
    ↓
Send audio.start with ACK
    ↓
Wait for ACK
    ↓
startCapture(chunkCallback)
    ↓
For each audio chunk:
    ↓
chunkCallback(chunk)
    ↓
Send audio.chunk via WebSocket
```

### Incoming (Playback)

```
WebSocket message arrives
    ↓
SocketManager routes to handler
    ↓
RESPONSE_CHUNK handler executes
    ↓
Extract and validate audio data
    ↓
Copy audio data (MessagePack buffer issue)
    ↓
playChunk(audioData, sampleRate, utteranceId)
    ↓
AudioPlayback queues and plays chunk
```

## Error Handling

### Connection Errors

```typescript
// WebSocket error handler
handlerMap.set('error', {
  handle: async (data, eventType, manager, unpackedMessage) => {
    const message = unpackedMessage || manager.decodeMessagePack(data);
    const payload = message.payload as { message?: string };
    const errorMessage = payload?.message || 'Unknown error';
    
    logger.error('WebSocket error', { errorMessage });
    setError(errorMessage);
    eventBus.emit('error', { message: errorMessage, code: 'ERROR', timestamp: 0 });
  },
});
```

### Recording Errors

```typescript
try {
  await startCapture(chunkCallback);
  setIsRecording(true);
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
  setError(errorMessage);
  logger.error('Error starting recording', err);
}
```

### Playback Errors

```typescript
playChunk(audioData, sampleRate, utteranceId).catch(err => {
  logger.error('Error playing audio chunk', err);
  setError('Failed to play audio');
});
```

## Best Practices

### 1. Memoize Event Handlers

```typescript
// ✅ GOOD: Memoized handlers
const handlers = useMemo(() => {
  // Create handler map
}, [playChunk, stopPlayback]);

// Prevents unnecessary re-registration
```

### 2. Validate Before Actions

```typescript
// ✅ GOOD: Check preconditions
if (!isConnected()) {
  setError('Not connected');
  return;
}

if (!sessionId) {
  setError('Session not ready');
  return;
}

// Proceed with action
```

### 3. Wait for ACKs

```typescript
// ✅ GOOD: Wait for ACK before proceeding
const ack = await sendMessagePackWithAck(event, 10000);
logger.info('ACK received');
await startCapture(); // Proceed after ACK

// ❌ BAD: Don't wait for ACK
sendMessagePack(event); // Fire and forget
await startCapture(); // May start before server is ready
```

### 4. Clean Error Messages

```typescript
// ✅ GOOD: User-friendly error
setError('Failed to start recording. Please check your microphone.');

// ❌ BAD: Technical error
setError('AudioCapture.start() threw NotAllowedError');
```

## Integration Points

### With useWebSocket

```typescript
const {
  connectionState,  // Display connection status
  sessionId,        // Required for sending messages
  connect,          // Connect button
  disconnect,       // Disconnect button
  sendMessagePack,  // Send audio chunks
  sendMessagePackWithAck,  // Send with ACK (audio.start, audio.end)
  isConnected,      // Check before sending
} = useWebSocket({ handlers });
```

### With useAudioCapture

```typescript
const {
  isCapturing,      // Display recording status
  hasPermission,    // Show permission warning
  startCapture,     // Start recording button
  stopCapture,      // Stop recording button
} = useAudioCapture({ sampleRate: 16000 });
```

### With useAudioPlayback

```typescript
const {
  playChunk,        // Called from RESPONSE_CHUNK handler
  stop,             // Called from RESPONSE_INTERRUPT/STOP handlers
  getIsPlaying,     // Check playback status (optional)
} = useAudioPlayback();
```

## Styling

Uses **TailwindCSS** utility classes:

```tsx
<div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
  <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
    {/* Content */}
  </div>
</div>
```

**Features**:
- Responsive design
- Dark mode support
- Centered layout
- Shadow and rounded corners

## Future Enhancements

### 1. Conversation History

```typescript
const [messages, setMessages] = useState<Message[]>([]);

// Add to RESPONSE_COMPLETE handler
setMessages(prev => [...prev, { utteranceId, text, timestamp }]);
```

### 2. Volume Indicator

```typescript
// Show audio level during recording
const [audioLevel, setAudioLevel] = useState(0);

// Update from audio capture
startCapture(async (chunk) => {
  const level = calculateAudioLevel(chunk);
  setAudioLevel(level);
  // ...
});
```

### 3. Playback Controls

```typescript
// Pause/resume playback
const { pause, resume } = useAudioPlayback();

<button onClick={pause}>Pause</button>
<button onClick={resume}>Resume</button>
```

### 4. Connection Status Indicator

```typescript
// Visual indicator (pulsing dot)
<div className={`status-dot ${connectionState === 'connected' ? 'connected' : 'disconnected'}`} />
```

## Related Documentation

- [ConnectionStatus Component](./ConnectionStatus.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)
- [useAudioCapture Hook](../hooks/useAudioCapture.md)
- [useAudioPlayback Hook](../hooks/useAudioPlayback.md)
- [Architecture Overview](../architecture/overview.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

