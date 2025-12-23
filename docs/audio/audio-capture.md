# Audio Capture System

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For architecture overview, see [Architecture Overview](../architecture/overview.md).  
> **For protocol details, see [Backend WebSocket Protocol](../../../vantum-backend/docs/protocol/websocket-protocol.md)**.

## Overview

The audio capture system captures microphone audio, converts it to Int16 PCM format, and streams it to the server via WebSocket in real-time chunks.

**Key Technology**: ScriptProcessorNode (deprecated but only option for raw PCM access)

## Architecture

```
Microphone (getUserMedia)
    ↓
MediaStream
    ↓
AudioContext
    ↓
MediaStreamSourceNode
    ↓
ScriptProcessorNode (⚠️ deprecated)
    ↓
onaudioprocess event (Float32 audio data)
    ↓
Convert Float32 → Int16 PCM
    ↓
Chunk callback (Uint8Array)
    ↓
WebSocket send
```

## AudioCapture Class

**Location**: `src/lib/audio/capture.ts`

### Class Structure

```typescript
export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isCapturing = false;

  async start(onChunk: (chunk: Uint8Array) => Promise<void>, sampleRate?: number): Promise<void>
  stop(): void
  getIsCapturing(): boolean
}
```

### Key Methods

#### `start(onChunk, sampleRate)`

**Purpose**: Start capturing audio from microphone

**Parameters**:
- `onChunk`: Callback function called for each audio chunk
- `sampleRate`: Desired sample rate (default: 16000 Hz)

**Steps**:
1. Request microphone permission (`getUserMedia`)
2. Create AudioContext with specified sample rate
3. Create MediaStreamSourceNode from microphone stream
4. Create ScriptProcessorNode for audio processing
5. Connect nodes: source → processor → destination
6. Set up `onaudioprocess` handler
7. Start capturing

**Returns**: Promise that resolves when capture starts

**Throws**: Error if permission denied or capture fails

#### `stop()`

**Purpose**: Stop audio capture and clean up resources

**Steps**:
1. Stop all MediaStream tracks
2. Disconnect audio nodes
3. Close AudioContext
4. Clear references
5. Set `isCapturing = false`

## ScriptProcessorNode

### Why ScriptProcessorNode?

**Problem**: Need raw PCM audio data from microphone

**Options**:
1. **AudioWorkletNode** (modern): Doesn't provide raw PCM access
2. **ScriptProcessorNode** (deprecated): Provides raw Float32 PCM data ✅

**Trade-off**: Use deprecated API because it's the only way to get raw audio.

### Configuration

```typescript
const bufferSize = 4096; // Samples per processing event
const inputChannels = 1;  // Mono
const outputChannels = 1; // Mono

const processor = audioContext.createScriptProcessor(
  bufferSize,
  inputChannels,
  outputChannels
);
```

**Buffer Size**: 4096 samples
- At 16000 Hz: 4096 / 16000 = 0.256 seconds per chunk
- Good balance of latency and efficiency

### Audio Processing

```typescript
processor.onaudioprocess = (event) => {
  if (!this.isCapturing) return;
  
  // Get Float32 audio data from input
  const inputBuffer = event.inputBuffer;
  const inputData = inputBuffer.getChannelData(0); // Mono (channel 0)
  
  // Convert Float32 → Int16 PCM
  const int16Data = new Int16Array(inputData.length);
  for (let i = 0; i < inputData.length; i++) {
    // Clamp to [-1, 1]
    const clamped = Math.max(-1, Math.min(1, inputData[i]));
    // Convert to Int16 (-32768 to 32767)
    int16Data[i] = Math.floor(clamped * 32767);
  }
  
  // Convert to Uint8Array for transmission
  const uint8Data = new Uint8Array(int16Data.buffer);
  
  // Call chunk callback
  onChunk(uint8Data).catch(error => {
    logger.error('Error in chunk callback', error);
  });
};
```

## Audio Format Conversion

### Float32 → Int16 PCM

AudioContext provides Float32 data in range [-1.0, 1.0]:

```typescript
// Convert Float32 (-1.0 to 1.0) → Int16 (-32768 to 32767)
for (let i = 0; i < inputData.length; i++) {
  // 1. Clamp to valid range
  const clamped = Math.max(-1, Math.min(1, inputData[i]));
  
  // 2. Scale to Int16 range
  // Multiply by 32767 (not 32768) to avoid overflow
  int16Data[i] = Math.floor(clamped * 32767);
}
```

**Normalization Details**:
- Float32 range: -1.0 to 1.0
- Multiply by 32767 (max positive Int16)
- Use `Math.floor()` for consistent rounding
- Clamp input to prevent overflow

### Int16 → Uint8Array

```typescript
// Int16Array is a typed array view
// Access underlying buffer as Uint8Array for transmission
const uint8Data = new Uint8Array(int16Data.buffer);
```

**Result**: Raw bytes ready for WebSocket transmission

## Permission Handling

### Request Permission

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

**Constraints**:
- `sampleRate`: Ideal sample rate (browser may use different rate)
- `channelCount`: Mono (1 channel)
- `echoCancellation`: Enabled (reduce echo)
- `noiseSuppression`: Enabled (reduce background noise)
- `autoGainControl`: Enabled (normalize volume)

### Permission States

```typescript
// Permission granted
hasPermission = true

// Permission denied
hasPermission = false

// Permission not yet requested
hasPermission = null
```

## Chunk Streaming

### Chunk Callback

```typescript
await startCapture(async (chunk: Uint8Array) => {
  // Send chunk via WebSocket
  if (isConnected() && sessionId) {
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
```

**Important**: Callback is async - can send to WebSocket

### Chunk Size

```typescript
// Buffer size: 4096 samples
// Sample rate: 16000 Hz
// Chunk duration: 4096 / 16000 = 0.256 seconds
// Chunk size: 4096 samples × 2 bytes/sample = 8192 bytes
```

**Frequency**: ~4 chunks per second at 16000 Hz

## Resource Management

### Cleanup on Stop

```typescript
stop(): void {
  // Stop all tracks
  if (this.mediaStream) {
    this.mediaStream.getTracks().forEach(track => track.stop());
  }
  
  // Disconnect nodes
  if (this.processorNode) {
    this.processorNode.disconnect();
  }
  if (this.sourceNode) {
    this.sourceNode.disconnect();
  }
  
  // Close context
  if (this.audioContext) {
    this.audioContext.close();
  }
  
  // Clear references
  this.audioContext = null;
  this.mediaStream = null;
  this.sourceNode = null;
  this.processorNode = null;
  this.isCapturing = false;
}
```

**Important**: Always call `stop()` to free resources.

## Error Handling

### Permission Denied

```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    throw new Error('Microphone permission denied');
  }
  throw error;
}
```

### Device Not Found

```typescript
catch (error) {
  if (error.name === 'NotFoundError') {
    throw new Error('No microphone found');
  }
  throw error;
}
```

### Capture Errors

```typescript
processor.onaudioprocess = (event) => {
  try {
    // Process audio
    onChunk(uint8Data).catch(error => {
      logger.error('Error in chunk callback', error);
    });
  } catch (error) {
    logger.error('Error processing audio', error);
  }
};
```

## Browser Compatibility

### Required APIs

- `navigator.mediaDevices.getUserMedia` ✅ All modern browsers
- `AudioContext` ✅ All modern browsers
- `ScriptProcessorNode` ⚠️ Deprecated but still supported

### Deprecation Notice

ScriptProcessorNode is deprecated in favor of AudioWorkletNode, but:
- AudioWorkletNode doesn't provide raw PCM access
- ScriptProcessorNode is still supported in all browsers
- No replacement available yet

**Future**: Monitor for AudioWorklet PCM access or use WebAssembly for processing.

## Performance Considerations

### 1. Buffer Size Trade-off

```
Smaller buffer (1024):
  ✅ Lower latency
  ❌ More CPU overhead (more frequent callbacks)
  
Larger buffer (8192):
  ❌ Higher latency
  ✅ Less CPU overhead
  
Chosen (4096):
  ✅ Good balance (256ms latency at 16kHz)
```

### 2. Async Chunk Callback

Chunk callback is async to allow WebSocket sending:

```typescript
onChunk(uint8Data).catch(error => {
  // Don't block audio processing if send fails
  logger.error('Error in chunk callback', error);
});
```

### 3. Sample Rate

Lower sample rate = less data:

```
16000 Hz: 16000 samples/sec × 2 bytes/sample = 32 KB/sec
24000 Hz: 24000 samples/sec × 2 bytes/sample = 48 KB/sec
48000 Hz: 48000 samples/sec × 2 bytes/sample = 96 KB/sec
```

**Chosen**: 16000 Hz (good quality, reasonable bandwidth)

## Related Documentation

- [Audio Playback](./audio-playback.md)
- [useAudioCapture Hook](../hooks/useAudioCapture.md)
- [VoiceChat Component](../components/VoiceChat.md)
- [Browser Compatibility](../reference/browser-compatibility.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

**⚠️ Note: ScriptProcessorNode is deprecated but required for raw PCM access.**

