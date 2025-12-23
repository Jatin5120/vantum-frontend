# useAudioCapture Hook

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For audio capture details, see [Audio Capture System](../audio/audio-capture.md).

## Overview

`useAudioCapture` is a custom React hook that manages microphone audio capture. It handles permission requests, audio capture lifecycle, and provides a callback-based API for streaming audio chunks.

**Location**: `src/hooks/useAudioCapture.ts`

## API

### Hook Signature

```typescript
function useAudioCapture(options: UseAudioCaptureOptions): UseAudioCaptureReturn

interface UseAudioCaptureOptions {
  sampleRate?: number;  // Default: 16000 Hz
}

interface UseAudioCaptureReturn {
  isCapturing: boolean;
  hasPermission: boolean | null;
  startCapture: (onChunk: (chunk: Uint8Array) => Promise<void>) => Promise<void>;
  stopCapture: () => void;
}
```

## Usage

### Basic Usage

```typescript
import { useAudioCapture } from '../hooks/useAudioCapture';

function MyComponent() {
  const { isCapturing, hasPermission, startCapture, stopCapture } = useAudioCapture({
    sampleRate: 16000
  });
  
  const handleStart = async () => {
    await startCapture(async (chunk) => {
      console.log('Audio chunk:', chunk.length, 'bytes');
      // Process chunk
    });
  };
  
  return (
    <div>
      <p>Permission: {hasPermission ? 'Granted' : 'Denied'}</p>
      <p>Capturing: {isCapturing ? 'Yes' : 'No'}</p>
      <button onClick={handleStart}>Start</button>
      <button onClick={stopCapture}>Stop</button>
    </div>
  );
}
```

### With WebSocket Streaming

```typescript
const { isCapturing, startCapture, stopCapture } = useAudioCapture({ sampleRate: 16000 });
const { sendMessagePack, sessionId } = useWebSocket();

const handleStartRecording = async () => {
  await startCapture(async (chunk: Uint8Array) => {
    // Stream chunk to server
    if (sessionId) {
      await sendMessagePack({
        eventType: VOICECHAT_EVENTS.AUDIO_CHUNK,
        eventId: generateEventId(),
        sessionId,
        payload: {
          audio: chunk,
          isMuted: false,
        },
      });
    }
  });
};
```

## State

### isCapturing

**Type**: `boolean`

**Values**:
- `true`: Currently capturing audio
- `false`: Not capturing

**Updates**: Set by `startCapture()` and `stopCapture()`

### hasPermission

**Type**: `boolean | null`

**Values**:
- `true`: Microphone permission granted
- `false`: Microphone permission denied
- `null`: Permission not yet requested

**Updates**: Set when `getUserMedia()` is called

## Methods

### startCapture(onChunk)

**Purpose**: Start capturing audio from microphone

**Parameters**:
- `onChunk`: Async callback called for each audio chunk
  - Receives `Uint8Array` (Int16 PCM audio data)
  - Should return `Promise<void>`

**Returns**: `Promise<void>` (resolves when capture starts)

**Throws**: Error if permission denied or capture fails

**Behavior**:
1. Request microphone permission (if not already granted)
2. Create AudioContext with specified sample rate
3. Set up audio processing pipeline
4. Start capturing audio
5. Call `onChunk` for each chunk (~4 times per second)
6. Set `isCapturing = true`
7. Set `hasPermission = true`

**Example**:
```typescript
await startCapture(async (chunk: Uint8Array) => {
  console.log('Chunk size:', chunk.length); // 8192 bytes at 16kHz
  await processChunk(chunk);
});
```

### stopCapture()

**Purpose**: Stop audio capture and clean up resources

**Returns**: `void`

**Behavior**:
1. Stop all MediaStream tracks
2. Disconnect audio nodes
3. Close AudioContext
4. Set `isCapturing = false`
5. Clear internal references

**Example**:
```typescript
stopCapture();
console.log('Capture stopped');
```

## Chunk Callback

### Callback Signature

```typescript
type ChunkCallback = (chunk: Uint8Array) => Promise<void>;
```

### Chunk Format

- **Type**: `Uint8Array`
- **Format**: Int16 PCM (little-endian)
- **Channels**: Mono (1 channel)
- **Sample Rate**: As specified in options (default: 16000 Hz)
- **Chunk Size**: 8192 bytes (4096 samples × 2 bytes/sample)
- **Duration**: ~256ms per chunk at 16kHz

### Callback Frequency

At 16000 Hz with 4096 sample buffer:
- **Frequency**: 16000 / 4096 ≈ 3.9 chunks per second
- **Interval**: ~256ms between chunks

### Async Callback

The callback is async to allow WebSocket sending:

```typescript
await startCapture(async (chunk) => {
  // Can await async operations
  await sendToServer(chunk);
});
```

**Error Handling**: Errors in callback are caught and logged, but don't stop capture:

```typescript
onChunk(chunk).catch(error => {
  logger.error('Error in chunk callback', error);
  // Capture continues
});
```

## Permission Handling

### Permission States

```typescript
hasPermission === null   // Not yet requested
hasPermission === true   // Granted
hasPermission === false  // Denied
```

### Permission Request

Permission is requested when `startCapture()` is called:

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: { ideal: sampleRate },
    channelCount: { ideal: 1 },
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  },
});
```

### Permission Denied

```typescript
try {
  await startCapture(callback);
} catch (error) {
  if (error.message.includes('permission denied')) {
    // Show permission error UI
    setError('Microphone permission denied. Please allow access.');
  }
}
```

## Resource Management

### Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    if (captureRef.current) {
      captureRef.current.stop(); // Clean up resources
      captureRef.current = null;
    }
  };
}, []);
```

**Important**: Always cleanup to prevent:
- Memory leaks
- Microphone staying active
- AudioContext resource exhaustion

### Cleanup on Stop

```typescript
stopCapture(); // Stops tracks, disconnects nodes, closes context
```

## Error Handling

### Common Errors

#### NotAllowedError

**Cause**: User denied microphone permission

**Solution**: Show permission request UI

#### NotFoundError

**Cause**: No microphone device found

**Solution**: Show "No microphone found" error

#### NotReadableError

**Cause**: Microphone in use by another application

**Solution**: Show "Microphone in use" error

### Error Handling Pattern

```typescript
try {
  await startCapture(callback);
} catch (error) {
  if (error instanceof Error) {
    if (error.name === 'NotAllowedError') {
      setError('Microphone permission denied');
    } else if (error.name === 'NotFoundError') {
      setError('No microphone found');
    } else if (error.name === 'NotReadableError') {
      setError('Microphone in use by another application');
    } else {
      setError('Failed to start audio capture');
    }
  }
  logger.error('Audio capture error', error);
}
```

## Best Practices

### 1. Check Permission Before Starting

```typescript
// ✅ GOOD: Show permission status
{hasPermission === false && (
  <div className="warning">
    Microphone permission denied. Please allow access.
  </div>
)}

<button 
  onClick={handleStart}
  disabled={hasPermission === false}
>
  Start Recording
</button>
```

### 2. Handle Errors Gracefully

```typescript
// ✅ GOOD: User-friendly error messages
catch (error) {
  const message = error instanceof Error 
    ? error.message 
    : 'Failed to start recording';
  setError(message);
}
```

### 3. Stop Capture on Unmount

```typescript
// ✅ GOOD: Cleanup on unmount
useEffect(() => {
  return () => {
    stopCapture();
  };
}, [stopCapture]);
```

### 4. Validate Chunk Data

```typescript
await startCapture(async (chunk) => {
  // ✅ GOOD: Validate before sending
  if (chunk.length === 0) {
    logger.warn('Empty audio chunk');
    return;
  }
  
  await sendToServer(chunk);
});
```

## Related Documentation

- [Audio Capture System](../audio/audio-capture.md)
- [VoiceChat Component](../components/VoiceChat.md)
- [Browser Compatibility](../reference/browser-compatibility.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

