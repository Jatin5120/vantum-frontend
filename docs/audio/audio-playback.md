# Audio Playback System

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For architecture overview, see [Architecture Overview](../architecture/overview.md).  
> **For protocol details, see [Backend WebSocket Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)**.

## Overview

The audio playback system receives Int16 PCM audio chunks from the server via WebSocket, converts them to Float32 format, and plays them through the browser's AudioContext API.

**Key Challenge**: Handling MessagePack buffer views correctly to avoid audio corruption.

## Architecture

```
WebSocket Message (MessagePack)
    ↓
Response Chunk Handler
    ↓
Extract audio data (Uint8Array)
    ↓
⚠️ CRITICAL: Copy buffer (MessagePack view issue)
    ↓
useAudioPlayback.playChunk()
    ↓
AudioPlayback.playChunk() → Add to queue
    ↓
AudioPlayback.processQueue() → Sequential playback
    ↓
AudioPlayback.playChunkImmediately()
    ↓
Convert Int16 → Float32
    ↓
Create AudioBuffer
    ↓
AudioBufferSourceNode.start()
    ↓
Browser Audio Output
```

## AudioPlayback Class

**Location**: `src/lib/audio/playback.ts`

### Class Structure

```typescript
export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private audioQueue: QueuedChunk[] = [];
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private currentUtteranceId: string | null = null;
  private sampleRate: number = 16000;
  private isProcessingQueue = false;

  async playChunk(audioData: Uint8Array, sampleRate: number, utteranceId: string): Promise<void>
  stop(): void
  async destroy(): Promise<void>
  getIsPlaying(): boolean
  getCurrentUtteranceId(): string | null
}
```

### Key Methods

#### `playChunk(audioData, sampleRate, utteranceId)`

**Purpose**: Queue audio chunk for playback

**Parameters**:
- `audioData`: Int16 PCM audio data (Uint8Array)
- `sampleRate`: Audio sample rate (typically 16000 Hz)
- `utteranceId`: Unique ID for this response (UUIDv7, time-ordered)

**Behavior**:
1. If new utteranceId, stop current playback and clear queue
2. Add chunk to queue
3. Sort queue by utteranceId (UUIDv7 is time-ordered)
4. Start queue processing if not already processing

**Important**: All chunks for the same response must use the **same utteranceId**.

#### `processQueue()`

**Purpose**: Process audio queue sequentially

**Behavior**:
1. Check if already processing (prevent concurrent processing)
2. While queue has chunks for current utterance:
   - Shift chunk from queue
   - Play chunk immediately
   - Wait for chunk to finish
   - Continue with next chunk
3. Mark processing complete

**Sequential Playback**: Chunks play one after another, no overlap.

#### `playChunkImmediately(audioData, sampleRate)`

**Purpose**: Play a single chunk immediately

**Steps**:
1. Initialize AudioContext
2. Validate inputs (data length, sample rate)
3. Convert Int16 PCM → Float32
4. Create AudioBuffer
5. Create AudioBufferSourceNode
6. Connect to destination
7. Start playback
8. Return promise that resolves when playback finishes

## Critical: Buffer Handling

### The Problem

MessagePack may return audio data as a **view into the original message buffer**:

```typescript
// MessagePack decodes message
const message = unpack(data); // data is Uint8Array

// payload.audio is a VIEW into the same buffer as 'data'
const audioData = message.payload.audio; // Uint8Array view

// ⚠️ PROBLEM: If 'data' buffer is reused, audioData becomes invalid!
```

### The Solution

**Always create a copy** of the audio data:

```typescript
// ✅ CORRECT: Create independent copy
let audioData: Uint8Array;
const rawAudio = payload.audio as unknown;

if (rawAudio instanceof Uint8Array) {
  // Create a copy to ensure independent data
  audioData = new Uint8Array(rawAudio);
} else if (rawAudio instanceof ArrayBuffer) {
  audioData = new Uint8Array(rawAudio);
} else if (ArrayBuffer.isView(rawAudio)) {
  const view = rawAudio as ArrayBufferView;
  // Create a copy from the view
  audioData = new Uint8Array(
    view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
  );
}
```

**Why this matters**:
- MessagePack may reuse buffers for performance
- If buffer is reused, the view becomes invalid
- Audio data gets corrupted
- Result: No audio or garbled audio

### Buffer Slicing in Playback

Additional buffer handling in `playChunkImmediately()`:

```typescript
// CRITICAL: Slice the buffer to ensure correct byte alignment
const buffer = processedAudioData.buffer.slice(
  processedAudioData.byteOffset,
  processedAudioData.byteOffset + processedAudioData.byteLength
);
const int16Array = new Int16Array(buffer);
```

**Why**:
- Uint8Array might be a view with non-zero byteOffset
- Int16Array needs proper alignment
- Slicing creates a new buffer starting at offset 0

## Audio Format Conversion

### Int16 PCM → Float32

AudioContext requires Float32 audio data in range [-1.0, 1.0]:

```typescript
// Convert Int16 (-32768 to 32767) → Float32 (-1.0 to 1.0)
const int16Array = new Int16Array(buffer);
const float32Array = new Float32Array(int16Array.length);

for (let i = 0; i < int16Array.length; i++) {
  // Symmetric normalization: divide by 32768.0
  const normalized = int16Array[i] / 32768.0;
  // Clamp to [-1, 1] to prevent edge cases
  float32Array[i] = Math.max(-1.0, Math.min(1.0, normalized));
}
```

**Normalization Details**:
- Int16 range: -32768 to 32767
- Divide by 32768.0 (not 32767) for symmetric range
- Clamp to prevent floating point errors

## Queue Management

### Queue Structure

```typescript
interface QueuedChunk {
  audio: Uint8Array;
  utteranceId: string;
  sampleRate: number;
  timestamp: number; // Fallback ordering
}
```

### Queue Ordering

Chunks are sorted by `utteranceId` (UUIDv7 is time-ordered):

```typescript
this.audioQueue.sort((a, b) => {
  if (a.utteranceId < b.utteranceId) return -1;
  if (a.utteranceId > b.utteranceId) return 1;
  return a.timestamp - b.timestamp; // Fallback
});
```

**Why UUIDv7**:
- Time-ordered (sortable by string comparison)
- Unique per chunk
- Maintains playback order

### Utterance Handling

When a new utterance starts:

```typescript
if (this.currentUtteranceId !== utteranceId) {
  this.stop();                    // Stop current playback
  this.currentUtteranceId = utteranceId;  // Set new utterance
  this.sampleRate = sampleRate;   // Update sample rate
}
```

**Behavior**: New utterance interrupts current playback.

## AudioContext Management

### Initialization

```typescript
private async initAudioContext(): Promise<AudioContext> {
  if (!this.audioContext) {
    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: this.sampleRate,
    });
  }
  
  // Handle suspended state (browser autoplay policy)
  if (this.audioContext.state === 'suspended') {
    await this.audioContext.resume();
  }
  
  return this.audioContext;
}
```

### Browser Autoplay Policy

Browsers may suspend AudioContext until user interaction:

```typescript
// AudioContext starts in 'suspended' state
// Must be resumed after user interaction
if (this.audioContext.state === 'suspended') {
  await this.audioContext.resume(); // Requires user gesture
}
```

**Solution**: Resume on first playback attempt (after user clicked "Start Recording").

### Cleanup

```typescript
async destroy(): Promise<void> {
  this.stop();
  
  if (this.audioContext) {
    await this.audioContext.close(); // Free resources
    this.audioContext = null;
  }
}
```

**Important**: Always call `destroy()` on unmount to prevent resource leaks.

## Playback Flow

### Sequential Playback

```
Chunk 1 arrives → Add to queue → Start processing
    ↓
Play Chunk 1 → Wait for finish
    ↓
Chunk 2 arrives → Add to queue (processing already started)
    ↓
Chunk 1 finishes → Process next
    ↓
Play Chunk 2 → Wait for finish
    ↓
Chunk 3 arrives → Add to queue
    ↓
Chunk 2 finishes → Process next
    ↓
Play Chunk 3 → Wait for finish
    ↓
Chunk 3 finishes → Queue empty → Stop processing
```

**Key**: Chunks play sequentially, no overlap.

### Concurrent Chunk Arrival

```typescript
// Multiple chunks can arrive while one is playing
playChunk(chunk1); // Starts processing
playChunk(chunk2); // Queued (processing = true)
playChunk(chunk3); // Queued (processing = true)

// Processing loop handles them sequentially
while (queue.length > 0) {
  const chunk = queue.shift();
  await playChunkImmediately(chunk); // Wait for finish
}
```

## Error Handling

### Validation Errors

```typescript
// Empty audio data
if (!audioData || audioData.length === 0) {
  reject(new Error('Audio data is empty'));
  return;
}

// Invalid sample rate
if (!Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 192000) {
  reject(new Error(`Invalid sample rate: ${sampleRate}`));
  return;
}

// Odd byte length (Int16 needs even bytes)
if (audioData.length % 2 !== 0) {
  logger.warn('Audio data length is not even, truncating');
  processedAudioData = audioData.slice(0, audioData.length - 1);
}
```

### Playback Errors

```typescript
try {
  await this.playChunkImmediately(chunk.audio, chunk.sampleRate);
} catch (error) {
  logger.error('Error playing audio chunk', error);
  // Continue with next chunk (don't stop entire playback)
}
```

### AudioContext Errors

```typescript
// Failed to resume
if (this.audioContext.state === 'suspended') {
  try {
    await this.audioContext.resume();
  } catch (error) {
    throw new Error('Failed to resume audio context. User interaction may be required.');
  }
}
```

## Performance Considerations

### 1. Lazy AudioContext Creation

AudioContext is only created when first chunk arrives:

```typescript
async playChunk(...) {
  if (!playbackRef.current) {
    playbackRef.current = new AudioPlayback(); // Lazy init
  }
  await playbackRef.current.playChunk(...);
}
```

### 2. Buffer Reuse Prevention

Always copy audio data to prevent buffer reuse issues:

```typescript
// Create independent copy
audioData = new Uint8Array(rawAudio);
```

### 3. Source Cleanup

AudioBufferSourceNode is cleaned up after playback:

```typescript
source.onended = () => {
  const index = this.activeSources.indexOf(source);
  if (index > -1) {
    this.activeSources.splice(index, 1);
  }
  resolve(); // Continue queue processing
};
```

## Common Issues and Solutions

### Issue 1: No Audio Playback

**Symptoms**:
- Chunks received but no sound
- "Unhandled event type" warnings

**Causes**:
1. Handlers not registered (React Strict Mode issue)
2. AudioContext suspended (autoplay policy)
3. Buffer corruption (MessagePack view issue)

**Solutions**:
1. See [React Strict Mode Compatibility](../architecture/react-strict-mode.md)
2. Ensure user interaction before playback
3. Always copy audio data (see Buffer Handling above)

### Issue 2: Garbled Audio

**Symptoms**:
- Audio plays but sounds corrupted
- Crackling or distortion

**Causes**:
1. Buffer view invalidated (MessagePack reused buffer)
2. Incorrect byte alignment
3. Wrong sample rate

**Solutions**:
1. Copy audio data immediately
2. Use `buffer.slice()` for proper alignment
3. Validate sample rate

### Issue 3: Audio Cuts Off

**Symptoms**:
- Audio starts but stops prematurely
- Not all chunks play

**Causes**:
1. New utterance interrupts current playback
2. Queue processing stopped
3. AudioContext closed

**Solutions**:
1. Check utteranceId consistency
2. Verify queue processing completes
3. Don't close AudioContext during playback

## Testing

### Manual Testing

```typescript
// Add temporary logging
logger.info('Chunk received', {
  utteranceId,
  audioLength: audioData.length,
  sampleRate,
  queueLength: this.audioQueue.length,
});
```

### Validation Checks

```typescript
// Verify audio data is copied
console.log('Buffer info:', {
  byteOffset: audioData.byteOffset,    // Should be 0
  bufferLength: audioData.buffer.byteLength,  // Should equal byteLength
  byteLength: audioData.byteLength,
});

// Verify conversion
console.log('Audio samples:', {
  int16Length: int16Array.length,
  float32Length: float32Array.length,
  firstSample: float32Array[0],      // Should be in [-1, 1]
  lastSample: float32Array[float32Array.length - 1],
});
```

## Best Practices

### 1. Always Copy Audio Data

```typescript
// ✅ GOOD: Create independent copy
audioData = new Uint8Array(rawAudio);

// ❌ BAD: Use view directly
audioData = rawAudio; // May become invalid!
```

### 2. Validate Before Processing

```typescript
// Validate sample rate
if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
  logger.error('Invalid sample rate');
  return;
}

// Validate audio data
if (!audioData || audioData.length === 0) {
  logger.error('Empty audio data');
  return;
}
```

### 3. Clean Up Resources

```typescript
useEffect(() => {
  return () => {
    if (playbackRef.current) {
      playbackRef.current.destroy(); // Clean up AudioContext
    }
  };
}, []);
```

### 4. Handle Interruptions

```typescript
// New utterance should stop current playback
if (this.currentUtteranceId !== utteranceId) {
  this.stop(); // Stop and clear queue
  this.currentUtteranceId = utteranceId;
}
```

## Configuration

### Audio Constants

```typescript
// src/lib/audio/constants.ts
export const AUDIO_CONSTANTS = {
  DEFAULT_SAMPLE_RATE: 16000,
  AUDIO_CONTEXT_OPTIONS: {
    latencyHint: 'interactive' as AudioContextLatencyCategory,
  },
} as const;
```

### Sample Rates

Supported sample rates: 8000, 16000, 24000, 48000 Hz

**Default**: 16000 Hz (good balance of quality and bandwidth)

## Related Documentation

- [Audio Capture](./audio-capture.md)
- [useAudioPlayback Hook](../hooks/useAudioPlayback.md)
- [VoiceChat Component](../components/VoiceChat.md)
- [WebSocket Client Architecture](../websocket/client-architecture.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

**⚠️ Critical: Always copy audio data from MessagePack to prevent buffer corruption.**

