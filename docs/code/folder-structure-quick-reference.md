# Folder Structure Quick Reference

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: For detailed documentation, see [Folder Structure Documentation](./folder-structure.md).

## Directory Tree

```
src/
├── main.tsx                    # Entry point
├── App.tsx                     # Root component
├── components/                 # React components
│   └── VoiceChat/
│       ├── VoiceChat.tsx
│       └── ConnectionStatus.tsx
├── hooks/                      # Custom hooks
│   ├── useWebSocket.ts
│   ├── useAudioCapture.ts
│   └── useAudioPlayback.ts
├── lib/                        # Core libraries
│   ├── websocket/             # WebSocket client
│   │   ├── client/
│   │   ├── manager/
│   │   ├── events/
│   │   └── config/
│   ├── audio/                 # Audio processing
│   │   ├── capture.ts
│   │   ├── playback.ts
│   │   └── constants.ts
│   └── utils/                 # Utilities
│       └── logger.ts
└── assets/                     # Static assets
```

## Import Examples

```typescript
// Components
import { VoiceChat } from './components/VoiceChat/VoiceChat';

// Hooks
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';

// Lib (via barrel files)
import { SocketManager, eventBus } from '../lib/websocket';
import { AudioCapture, AudioPlayback } from '../lib/audio';
import { logger } from '../lib/utils/logger';

// Shared package
import { VOICECHAT_EVENTS } from '@Jatin5120/vantum-shared';

// External
import { pack, unpack } from 'msgpackr';
```

## Key Conventions

| Type | Location | Naming | Example |
|------|----------|--------|---------|
| Component | `components/` | PascalCase.tsx | `VoiceChat.tsx` |
| Hook | `hooks/` | useCamelCase.ts | `useWebSocket.ts` |
| Class | `lib/` | kebab-case.ts | `socket-manager.ts` |
| Type | `*/types.ts` | PascalCase | `ConnectionState` |
| Constant | `*/constants.ts` | UPPER_SNAKE_CASE | `DEFAULT_SAMPLE_RATE` |

## Quick Rules

1. **Components** → Use hooks for logic
2. **Hooks** → Bridge to lib classes
3. **Lib** → Framework-agnostic
4. **Barrel files** → Clean public APIs
5. **Types** → Strict TypeScript
6. **Imports** → Absolute paths preferred

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23

