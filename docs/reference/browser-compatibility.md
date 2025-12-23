# Browser Compatibility

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

## Supported Browsers

### Desktop

| Browser | Minimum Version | Recommended | Notes |
|---------|----------------|-------------|-------|
| Chrome | 90+ | Latest | Full support |
| Edge | 90+ | Latest | Full support |
| Firefox | 88+ | Latest | Full support |
| Safari | 14+ | Latest | Full support |

### Mobile

| Browser | Minimum Version | Recommended | Notes |
|---------|----------------|-------------|-------|
| Chrome Mobile | 90+ | Latest | Full support |
| Safari iOS | 14+ | Latest | Full support |
| Firefox Mobile | 88+ | Latest | Full support |

## Required Web APIs

### WebSocket API

**Support**: All modern browsers ✅

```typescript
const ws = new WebSocket('ws://localhost:3001/ws');
```

**Fallback**: None (WebSocket is required)

### Web Audio API

**Support**: All modern browsers ✅

#### AudioContext

```typescript
const audioContext = new AudioContext({
  sampleRate: 16000,
  latencyHint: 'interactive',
});
```

**Support**: Chrome 35+, Firefox 25+, Safari 14+

#### ScriptProcessorNode

```typescript
const processor = audioContext.createScriptProcessor(4096, 1, 1);
```

**Status**: ⚠️ **Deprecated** but still supported in all browsers

**Replacement**: AudioWorkletNode (doesn't provide raw PCM access)

**Future**: Monitor for AudioWorklet PCM support or use WebAssembly

#### AudioBufferSourceNode

```typescript
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start(0);
```

**Support**: All modern browsers ✅

### MediaDevices API

**Support**: All modern browsers ✅

#### getUserMedia

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: { ideal: 16000 },
    channelCount: { ideal: 1 },
  },
});
```

**Support**: Chrome 53+, Firefox 36+, Safari 11+

**Permissions**: Requires HTTPS in production (localhost OK for development)

## Known Issues

### 1. ScriptProcessorNode Deprecation

**Issue**: ScriptProcessorNode is deprecated

**Impact**: Browser console shows deprecation warning

**Status**: No impact on functionality (still fully supported)

**Future**: 
- Monitor AudioWorklet PCM access
- Consider WebAssembly for audio processing
- No immediate action required

### 2. AudioContext Autoplay Policy

**Issue**: Browsers may suspend AudioContext until user interaction

**Impact**: First audio playback may fail if no user interaction

**Solution**: AudioContext is resumed automatically on first playback attempt (after user clicked "Start Recording")

```typescript
if (this.audioContext.state === 'suspended') {
  await this.audioContext.resume(); // Requires user gesture
}
```

### 3. HTTPS Requirement for getUserMedia

**Issue**: getUserMedia requires HTTPS in production

**Impact**: Microphone access denied on HTTP sites

**Solution**: 
- Development: localhost is exempt (HTTP OK)
- Production: Use HTTPS

### 4. iOS Safari Audio Limitations

**Issue**: iOS Safari has strict audio policies

**Limitations**:
- AudioContext must be created in user gesture handler
- Audio may not play in background
- Silent mode may mute audio

**Solution**: Ensure AudioContext creation happens after user interaction

## Browser-Specific Notes

### Chrome/Edge

- Full support for all features ✅
- Best performance
- Recommended for development

### Firefox

- Full support for all features ✅
- Slightly different AudioContext behavior
- May require user interaction for audio

### Safari

- Full support for all features ✅
- Stricter autoplay policies
- May require explicit user interaction for audio
- iOS: Additional limitations (see above)

## Feature Detection

### Check WebSocket Support

```typescript
if ('WebSocket' in window) {
  // WebSocket supported
} else {
  // Show error: Browser not supported
}
```

### Check Web Audio API

```typescript
if ('AudioContext' in window || 'webkitAudioContext' in window) {
  // Web Audio API supported
} else {
  // Show error: Audio not supported
}
```

### Check getUserMedia

```typescript
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  // getUserMedia supported
} else {
  // Show error: Microphone access not supported
}
```

## Polyfills

### Not Required

All required APIs are supported in our minimum browser versions. No polyfills needed.

## Testing

### Browser Testing Matrix

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ iOS Safari (latest)
- ✅ Chrome Mobile (latest)

### Test Cases

1. WebSocket connection
2. Microphone permission
3. Audio capture
4. Audio playback
5. Reconnection
6. Error handling

## Performance

### Browser Performance Comparison

| Browser | WebSocket | Audio Capture | Audio Playback | Overall |
|---------|-----------|---------------|----------------|---------|
| Chrome | Excellent | Excellent | Excellent | Best |
| Edge | Excellent | Excellent | Excellent | Best |
| Firefox | Excellent | Good | Good | Good |
| Safari | Good | Good | Good | Good |

### Optimization Tips

1. **Chrome**: Best performance, use for development
2. **Firefox**: May need higher buffer sizes for audio
3. **Safari**: Test autoplay policies carefully

## Related Documentation

- [Setup Guide](../development/setup.md)
- [Audio Capture](../audio/audio-capture.md)
- [Audio Playback](../audio/audio-playback.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

