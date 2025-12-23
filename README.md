# Vantum Frontend

Real-time voice chat interface built with React, TypeScript, and Web Audio API. Communicates with the backend via WebSocket + MessagePack protocol.

## Features

- 🎙️ **Real-time Audio Capture**: Microphone audio capture with PCM encoding
- 🔊 **Audio Playback**: Sequential audio chunk playback with queue management
- 🔌 **WebSocket Communication**: Binary MessagePack protocol for efficient data transfer
- 🎯 **Type-Safe**: Full TypeScript with strict mode
- ⚡ **Fast Development**: Vite with HMR and fast refresh
- 🎨 **Modern UI**: TailwindCSS with dark mode support
- 🔄 **React Strict Mode Compatible**: Production-ready React 18 patterns

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+ (or npm)
- Backend server running at `ws://localhost:3001/ws`

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Opens at: `http://localhost:5173/`

### Build for Production

```bash
pnpm build
pnpm preview
```

## Documentation

📚 **Comprehensive documentation available in [`docs/`](docs/README.md)**

### Quick Links

- 🏗️ **[Architecture Overview](docs/architecture/overview.md)** - System architecture and design patterns
- ⚠️ **[React Strict Mode](docs/architecture/react-strict-mode.md)** - Critical: Handler registration fix
- 🔌 **[WebSocket Client](docs/websocket/client-architecture.md)** - WebSocket architecture
- 🎵 **[Audio System](docs/audio/audio-playback.md)** - Audio capture and playback
- 🎣 **[Custom Hooks](docs/hooks/useWebSocket.md)** - Hook documentation
- 💻 **[Setup Guide](docs/development/setup.md)** - Development setup
- 📋 **[Best Practices](docs/development/best-practices.md)** - Coding standards

### Documentation Structure

```
docs/
├── README.md                    # Documentation index
├── architecture/                # System architecture (3 docs)
├── components/                  # Component docs (2 docs)
├── hooks/                       # Hook docs (3 docs)
├── websocket/                   # WebSocket client (3 docs)
├── audio/                       # Audio system (2 docs)
├── development/                 # Dev guides (2 docs)
├── code/                        # Code organization (2 docs)
└── reference/                   # Reference materials (1 doc)

Total: 20 documentation files, ~8,000 lines
```

## Technology Stack

### Core

- **React 18**: UI framework with Strict Mode
- **TypeScript**: Type safety with strict mode
- **Vite**: Build tool and dev server
- **TailwindCSS**: Utility-first styling

### WebSocket & Audio

- **WebSocket API**: Browser native WebSocket
- **msgpackr**: MessagePack binary serialization
- **Web Audio API**: AudioContext for playback
- **MediaDevices API**: getUserMedia for capture
- **uuid**: UUIDv7 generation

### Shared

- **@Jatin5120/vantum-shared**: Shared types and events

## Project Structure

```
src/
├── components/          # React components
│   └── VoiceChat/      # Voice chat feature
├── hooks/              # Custom React hooks
│   ├── useWebSocket.ts
│   ├── useAudioCapture.ts
│   └── useAudioPlayback.ts
├── lib/                # Core libraries
│   ├── websocket/     # WebSocket client
│   ├── audio/         # Audio processing
│   └── utils/         # Utilities
└── main.tsx           # Entry point
```

See [Folder Structure](docs/code/folder-structure.md) for details.

## Key Features

### WebSocket Client

- **SocketManager**: High-level WebSocket API
- **HandlerRegistry**: Event routing system
- **RequestTracker**: ACK tracking for reliable delivery
- **EventBus**: Cross-component communication

### Audio System

- **AudioCapture**: Microphone → Int16 PCM streaming
- **AudioPlayback**: Audio queue → AudioContext playback
- **Format Conversion**: Int16 ↔ Float32 conversion
- **Buffer Handling**: MessagePack buffer safety

### React Patterns

- **Custom Hooks**: Reusable stateful logic
- **Strict Mode Compatible**: Production-ready patterns
- **Event-Driven**: Loose coupling via event bus
- **Type-Safe**: Full TypeScript coverage

## Critical Implementation Notes

### 1. React Strict Mode Compatibility

**Issue**: React Strict Mode runs effects twice, causing handler registration issues.

**Solution**: Clear handler tracking ref on manager recreation.

**See**: [React Strict Mode Documentation](docs/architecture/react-strict-mode.md) ⚠️ **Required reading**

### 2. MessagePack Buffer Handling

**Issue**: MessagePack may return views into shared buffer that become invalid.

**Solution**: Always copy audio data to independent buffer.

```typescript
// ✅ CORRECT
audioData = new Uint8Array(payload.audio);

// ❌ WRONG
audioData = payload.audio; // May become invalid!
```

**See**: [Audio Playback - Buffer Handling](docs/audio/audio-playback.md#critical-buffer-handling)

### 3. ScriptProcessorNode Deprecation

**Status**: Deprecated but required (only way to get raw PCM audio)

**Impact**: Browser console shows deprecation warning (harmless)

**Future**: Monitor AudioWorklet PCM support

## Development

### Available Scripts

```bash
pnpm dev      # Start dev server (http://localhost:5173)
pnpm build    # Build for production
pnpm preview  # Preview production build
pnpm lint     # Run ESLint
```

### Environment Variables

Create `.env.local`:

```bash
VITE_WS_URL=ws://localhost:3001/ws
```

### Hot Module Replacement

Vite provides instant HMR for fast development:
- Save file → Browser updates instantly
- State preserved during updates
- Fast refresh for React components

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

See [Browser Compatibility](docs/reference/browser-compatibility.md) for details.

## Contributing

1. Read [Best Practices](docs/development/best-practices.md)
2. Follow [Folder Structure](docs/code/folder-structure.md)
3. Understand [React Strict Mode](docs/architecture/react-strict-mode.md)
4. Write tests (future)
5. Update documentation

## Related Projects

- **Backend**: `../vantum-backend` - WebSocket server and AI pipeline
- **Shared**: `@Jatin5120/vantum-shared` - Shared types and events

## License

[Your License]

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Production Ready
