# useAudioPlayback Hook

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For audio playback details, see [Audio Playback System](../audio/audio-playback.md).

## Overview

`useAudioPlayback` is a custom React hook that manages audio playback. It provides a simple API for playing audio chunks received from the server.

**Location**: `src/hooks/useAudioPlayback.ts`

## API

### Hook Signature

```typescript
function useAudioPlayback(): UseAudioPlaybackReturn

interface UseAudioPlaybackReturn {
  playChunk: (audioData: Uint8Array, sampleRate: number, utteranceId: string) => Promise<void>;
  stop: () => void;
  getIsPlaying: () => boolean;
}
```

## Usage

### Basic Usage

```typescript
import { useAudioPlayback } from '../hooks/useAudioPlayback';

function MyComponent() {
  const { playChunk, stop, getIsPlaying } = useAudioPlayback();
  
  const handlePlay = async () => {
    const audioData = new Uint8Array([...]); // Int16 PCM data
    await playChunk(audioData, 16000, 'utterance-id');
  };
  
  return (
    <div>
      <button onClick={handlePlay}>Play</button>
      <button onClick={stop}>Stop</button>
      <p>Playing: {getIsPlaying() ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### With WebSocket Handler

```typescript
const { playChunk, stop } = useAudioPlayback();

const handlers = useMemo(() => {
  const map = new Map();
  
  map.set(VOICECHAT_EVENTS.RESPONSE_CHUNK, {
    handle: async (data, eventType, manager, unpackedMessage) => {
      const message = unpackedMessage || manager.decodeMessagePack(data);
      const payload = message.payload as ResponseChunkPayload;
      
      // CRITICAL: Copy audio data (MessagePack buffer issue)
      const audioData = new Uint8Array(payload.audio);
      
      // Play chunk
      await playChunk(audioData, payload.sampleRate, payload.utteranceId);
    },
  });
  
  map.set(VOICECHAT_EVENTS.RESPONSE_INTERRUPT, {
    handle: async () => {
      stop(); // Stop playback on interrupt
    },
  });
  
  return map;
}, [playChunk, stop]);
```

## Methods

### playChunk(audioData, sampleRate, utteranceId)

**Purpose**: Queue and play an audio chunk

**Parameters**:
- `audioData`: Int16 PCM audio data (Uint8Array)
- `sampleRate`: Audio sample rate (Hz)
- `utteranceId`: Unique ID for this response (UUIDv7)

**Returns**: `Promise<void>` (resolves immediately after queueing)

**Behavior**:
1. If new utteranceId, stop current playback and clear queue
2. Add chunk to queue
3. Sort queue by utteranceId
4. Start queue processing if not already processing
5. Chunks play sequentially

**Important**: All chunks for the same response must use the **same utteranceId**.

**Example**:
```typescript
// Chunk 1
await playChunk(audioData1, 16000, 'utterance-123');

// Chunk 2 (same utterance)
await playChunk(audioData2, 16000, 'utterance-123');

// Chunk 3 (new utterance - stops previous)
await playChunk(audioData3, 16000, 'utterance-456');
```

### stop()

**Purpose**: Stop current playback and clear queue

**Returns**: `void`

**Behavior**:
1. Stop all active AudioBufferSourceNodes
2. Clear audio queue
3. Reset playback state
4. Clear current utteranceId

**Example**:
```typescript
stop(); // Immediately stops all audio
```

### getIsPlaying()

**Purpose**: Check if audio is currently playing

**Returns**: `boolean`

**Example**:
```typescript
if (getIsPlaying()) {
  console.log('Audio is playing');
}
```

## Internal Implementation

### Lazy Initialization

AudioPlayback instance is created lazily on first use:

```typescript
const playbackRef = useRef<AudioPlayback | null>(null);

const playChunk = useCallback(async (audioData, sampleRate, utteranceId) => {
  if (!playbackRef.current) {
    playbackRef.current = new AudioPlayback(); // Lazy init
  }
  
  await playbackRef.current.playChunk(audioData, sampleRate, utteranceId);
}, []);
```

**Benefits**:
- AudioContext only created when needed
- Avoids autoplay policy issues
- Better resource management

### Cleanup on Unmount

```typescript
useEffect(() => {
  return () => {
    if (playbackRef.current) {
      playbackRef.current.destroy().catch(error => {
        console.error('Error destroying AudioPlayback:', error);
      });
      playbackRef.current = null;
    }
  };
}, []);
```

**Important**: Always cleanup to prevent:
- AudioContext resource leaks
- Memory leaks
- Orphaned audio nodes

## Utterance Management

### What is an Utterance?

An **utterance** is a single response from the server. All audio chunks for one response share the same `utteranceId`.

```
Response 1: utteranceId = 'abc-123'
  - Chunk 1: utteranceId = 'abc-123'
  - Chunk 2: utteranceId = 'abc-123'
  - Chunk 3: utteranceId = 'abc-123'

Response 2: utteranceId = 'def-456'
  - Chunk 1: utteranceId = 'def-456'
  - Chunk 2: utteranceId = 'def-456'
```

### Utterance Switching

When a new utterance starts, current playback is stopped:

```typescript
// Playing utterance 'abc-123'
await playChunk(chunk1, 16000, 'abc-123'); // Plays

// New utterance 'def-456' arrives
await playChunk(chunk2, 16000, 'def-456'); // Stops 'abc-123', plays 'def-456'
```

**Use Case**: User interrupts AI response (new response starts)

## Error Handling

### Playback Errors

```typescript
playChunk(audioData, sampleRate, utteranceId).catch(err => {
  logger.error('Error playing audio chunk', err);
  setError('Failed to play audio');
});
```

**Common Errors**:
- Empty audio data
- Invalid sample rate
- AudioContext suspended
- AudioContext closed

### Error Recovery

```typescript
// Errors don't stop future playback
try {
  await playChunk(chunk1, 16000, 'id-1'); // Fails
} catch (error) {
  // Log error, continue
}

// Next chunk still works
await playChunk(chunk2, 16000, 'id-2'); // Works
```

## Best Practices

### 1. Always Copy Audio Data

```typescript
// ✅ GOOD: Copy audio data from MessagePack
const audioData = new Uint8Array(payload.audio);
await playChunk(audioData, sampleRate, utteranceId);

// ❌ BAD: Use MessagePack view directly
await playChunk(payload.audio, sampleRate, utteranceId); // May become invalid!
```

See [Audio Playback - Buffer Handling](../audio/audio-playback.md#critical-buffer-handling) for details.

### 2. Handle Errors

```typescript
// ✅ GOOD: Catch and handle errors
playChunk(audioData, sampleRate, utteranceId).catch(err => {
  logger.error('Playback error', err);
  setError('Failed to play audio');
});

// ❌ BAD: Unhandled promise rejection
playChunk(audioData, sampleRate, utteranceId); // May throw!
```

### 3. Stop on Interrupt

```typescript
// ✅ GOOD: Stop playback when interrupted
map.set(VOICECHAT_EVENTS.RESPONSE_INTERRUPT, {
  handle: async () => {
    stop(); // Stop current playback
  },
});
```

### 4. Validate Sample Rate

```typescript
// ✅ GOOD: Validate and fallback
let sampleRate = payload.sampleRate;
if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
  sampleRate = AUDIO_CONSTANTS.DEFAULT_SAMPLE_RATE;
}

await playChunk(audioData, sampleRate, utteranceId);
```

## Common Issues

### Issue: No Audio Playback

**Symptoms**: `playChunk()` called but no sound

**Causes**:
1. AudioContext suspended (autoplay policy)
2. Buffer corruption (MessagePack view issue)
3. Invalid audio data

**Solutions**:
1. Ensure user interaction before playback
2. Always copy audio data
3. Validate audio data and sample rate

See [Audio Playback Troubleshooting](../audio/audio-playback.md#common-issues-and-solutions).

### Issue: Audio Cuts Off

**Symptoms**: Audio starts but stops prematurely

**Causes**:
1. New utterance interrupts current playback
2. `stop()` called unexpectedly
3. AudioContext closed

**Solutions**:
1. Check utteranceId consistency
2. Review stop() calls
3. Don't close AudioContext during playback

### Issue: Garbled Audio

**Symptoms**: Audio plays but sounds corrupted

**Causes**:
1. Buffer view invalidated (MessagePack reused buffer)
2. Incorrect sample rate
3. Wrong audio format

**Solutions**:
1. **Always copy audio data** (most common cause)
2. Validate sample rate
3. Verify Int16 PCM format

## Related Documentation

- [Audio Playback System](../audio/audio-playback.md)
- [VoiceChat Component](../components/VoiceChat.md)
- [useWebSocket Hook](./useWebSocket.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

**⚠️ Critical: Always copy audio data from MessagePack to prevent buffer corruption.**

