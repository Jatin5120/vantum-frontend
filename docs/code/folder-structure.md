# Folder Structure Documentation

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

## Overview

The Vantum frontend follows a **feature-based architecture** with clear separation between components, hooks, and library code. This structure promotes:

- **Modularity**: Each feature is self-contained
- **Scalability**: Easy to add new features without affecting existing ones
- **Maintainability**: Clear boundaries and responsibilities
- **Reusability**: Shared utilities and hooks are easily accessible
- **Type Safety**: TypeScript throughout

## Current Structure

```
src/
├── main.tsx                    # Application entry point
├── App.tsx                     # Root component
├── index.css                   # Global styles
│
├── components/                 # React components
│   └── VoiceChat/             # Voice chat feature
│       ├── VoiceChat.tsx      # Main component
│       └── ConnectionStatus.tsx # Status display
│
├── hooks/                      # Custom React hooks
│   ├── useWebSocket.ts        # WebSocket connection management
│   ├── useAudioCapture.ts     # Audio capture logic
│   └── useAudioPlayback.ts    # Audio playback logic
│
├── lib/                        # Core libraries (framework-agnostic)
│   ├── websocket/             # WebSocket client library
│   │   ├── index.ts           # Public API (barrel file)
│   │   ├── client/            # Low-level WebSocket client
│   │   │   ├── socket-client.ts
│   │   │   ├── network-monitor.ts
│   │   │   └── types.ts
│   │   ├── manager/           # High-level WebSocket manager
│   │   │   ├── socket-manager.ts
│   │   │   ├── handler-registry.ts
│   │   │   └── request-tracker.ts
│   │   ├── events/            # Event bus system
│   │   │   ├── event-bus.ts
│   │   │   └── event-emitter.ts
│   │   ├── config/            # WebSocket configuration
│   │   │   └── websocket-config.ts
│   │   ├── constants.ts       # WebSocket constants
│   │   ├── message-pack.ts    # MessagePack utilities
│   │   └── types.ts           # WebSocket types
│   │
│   ├── audio/                 # Audio processing library
│   │   ├── index.ts           # Public API (barrel file)
│   │   ├── capture.ts         # Audio capture (microphone)
│   │   ├── playback.ts        # Audio playback (speakers)
│   │   └── constants.ts       # Audio constants
│   │
│   └── utils/                 # Shared utilities
│       └── logger.ts          # Logging utility
│
└── assets/                     # Static assets
    └── react.svg
```

## Architecture Principles

### 1. Feature-Based Organization

Features are organized by domain, not by technical layer:

**✅ GOOD** (Feature-based):
```
components/
  VoiceChat/
    VoiceChat.tsx
    ConnectionStatus.tsx
```

**❌ BAD** (Layer-based):
```
components/
  VoiceChat.tsx
  ConnectionStatus.tsx
  AudioControls.tsx
  ...
```

### 2. Separation: Components vs Hooks vs Lib

**Components** (`src/components/`):
- React components
- JSX/TSX files
- UI-focused
- Use hooks for logic

**Hooks** (`src/hooks/`):
- Custom React hooks
- Stateful logic
- React-specific
- Bridge between components and lib

**Lib** (`src/lib/`):
- Framework-agnostic code
- Pure TypeScript classes
- No React dependencies
- Reusable across frameworks

**Example**:
```typescript
// lib/audio/playback.ts - Framework-agnostic
export class AudioPlayback {
  async playChunk(data: Uint8Array) { /* ... */ }
}

// hooks/useAudioPlayback.ts - React-specific
export function useAudioPlayback() {
  const playbackRef = useRef<AudioPlayback | null>(null);
  // React hooks, lifecycle, state
  return { playChunk, stop };
}

// components/VoiceChat/VoiceChat.tsx - UI
export function VoiceChat() {
  const { playChunk } = useAudioPlayback();
  return <div>...</div>;
}
```

### 3. Barrel Files (index.ts)

Each module exports a clean public API via `index.ts`:

```typescript
// lib/websocket/index.ts
export { SocketManager } from './manager/socket-manager';
export { eventBus } from './events/event-bus';
export * from './types';
export * from './message-pack';
```

**Benefits**:
- Clean imports: `import { SocketManager } from '@/lib/websocket'`
- Encapsulation: Internal files can be refactored without breaking imports
- API clarity: Explicit exports show what's public

### 4. Type Safety

TypeScript is used throughout with strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Import Patterns

### Absolute Imports

Use absolute imports for better refactoring:

```typescript
// ✅ GOOD: Absolute imports
import { SocketManager } from '../../lib/websocket';
import { logger } from '../../lib/utils/logger';

// Relative imports are fine for nearby files
import { ConnectionStatus } from './ConnectionStatus';
```

### Import Order

Follow this order for clean, organized imports:

```typescript
// 1. External dependencies
import { useState, useCallback } from 'react';
import { pack, unpack } from 'msgpackr';

// 2. Shared package
import { VOICECHAT_EVENTS, type EventMessage } from '@Jatin5120/vantum-shared';

// 3. Internal lib
import { SocketManager } from '../../lib/websocket';
import { logger } from '../../lib/utils/logger';

// 4. Local imports
import { ConnectionStatus } from './ConnectionStatus';
```

### Barrel File Exports

```typescript
// lib/websocket/index.ts - Public API
export { SocketManager } from './manager/socket-manager';
export { eventBus } from './events/event-bus';
export type { SocketEventHandler } from './manager/handler-registry';
export * from './types';
export * from './message-pack';

// Internal files not exported (encapsulated)
// - client/socket-client.ts
// - manager/request-tracker.ts
```

## Module Responsibilities

### `src/components/`

**Purpose**: React UI components

**Contains**:
- `.tsx` files only
- Component-specific styles (if any)
- Component-specific types (if small)

**Responsibilities**:
- Render UI
- Handle user interactions
- Manage component-level state
- Use hooks for business logic

**Example**:
```typescript
// VoiceChat.tsx
export function VoiceChat() {
  const [error, setError] = useState<string | null>(null);
  const { connect, disconnect } = useWebSocket({ handlers });
  
  return (
    <div>
      <button onClick={connect}>Connect</button>
      {error && <div>{error}</div>}
    </div>
  );
}
```

### `src/hooks/`

**Purpose**: Custom React hooks

**Contains**:
- `.ts` files (hooks don't render, so no JSX)
- React-specific logic
- State management
- Effect management

**Responsibilities**:
- Encapsulate stateful logic
- Provide clean API to components
- Bridge between components and lib
- Handle React lifecycle

**Example**:
```typescript
// useWebSocket.ts
export function useWebSocket(options: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const managerRef = useRef<SocketManager | null>(null);
  
  useEffect(() => {
    // Setup and cleanup
  }, []);
  
  return { connectionState, connect, disconnect };
}
```

### `src/lib/websocket/`

**Purpose**: WebSocket client library

**Contains**:
- Framework-agnostic TypeScript classes
- WebSocket connection management
- Message serialization
- Event routing

**Responsibilities**:
- Low-level WebSocket operations
- MessagePack encoding/decoding
- Connection lifecycle
- Event routing

**Subdirectories**:
- `client/`: Low-level WebSocket client
- `manager/`: High-level manager + routing
- `events/`: Event bus system
- `config/`: Configuration

### `src/lib/audio/`

**Purpose**: Audio processing library

**Contains**:
- Framework-agnostic TypeScript classes
- Audio capture logic
- Audio playback logic
- Format conversion

**Responsibilities**:
- Microphone audio capture
- PCM audio encoding/decoding
- AudioContext management
- Audio queue management

**Files**:
- `capture.ts`: Audio capture class
- `playback.ts`: Audio playback class
- `constants.ts`: Audio constants

### `src/lib/utils/`

**Purpose**: Shared utilities

**Contains**:
- Utility functions
- Helper classes
- Common functionality

**Responsibilities**:
- Logging
- Formatting
- Common helpers

## File Naming Conventions

### Components

```
PascalCase.tsx
VoiceChat.tsx
ConnectionStatus.tsx
```

### Hooks

```
camelCase.ts (with 'use' prefix)
useWebSocket.ts
useAudioCapture.ts
useAudioPlayback.ts
```

### Classes

```
kebab-case.ts (file) + PascalCase (class)
socket-manager.ts → export class SocketManager
audio-playback.ts → export class AudioPlayback
```

### Types

```
kebab-case.ts
types.ts
socket.ts (contains socket-related types)
```

### Utilities

```
kebab-case.ts
logger.ts
message-pack.ts
```

## Adding New Features

### Adding a New Component

```
1. Create directory: src/components/NewFeature/
2. Create component: src/components/NewFeature/NewFeature.tsx
3. Create sub-components (if needed): src/components/NewFeature/SubComponent.tsx
4. Export from component file (no index.ts needed for components)
```

### Adding a New Hook

```
1. Create file: src/hooks/useNewFeature.ts
2. Implement hook following patterns in existing hooks
3. Export hook (no barrel file needed for hooks)
```

### Adding a New Library Module

```
1. Create directory: src/lib/new-feature/
2. Create implementation files: src/lib/new-feature/feature.ts
3. Create types: src/lib/new-feature/types.ts
4. Create barrel file: src/lib/new-feature/index.ts
5. Export public API from barrel file
```

### Example: Adding Chat Feature

```
src/
├── components/
│   └── Chat/
│       ├── Chat.tsx
│       ├── ChatMessage.tsx
│       └── ChatInput.tsx
│
├── hooks/
│   └── useChat.ts
│
└── lib/
    └── chat/
        ├── index.ts
        ├── chat-manager.ts
        ├── message-formatter.ts
        └── types.ts
```

## Import Guidelines

### Internal Imports

```typescript
// From component to hook
import { useWebSocket } from '../../hooks/useWebSocket';

// From hook to lib
import { SocketManager } from '../lib/websocket';

// From lib to lib
import { logger } from '../utils/logger';
```

### External Imports

```typescript
// React
import { useState, useEffect } from 'react';

// Third-party
import { pack, unpack } from 'msgpackr';
import { v7 as uuidv7 } from 'uuid';

// Shared package
import { VOICECHAT_EVENTS } from '@Jatin5120/vantum-shared';
```

### Barrel File Imports

```typescript
// ✅ GOOD: Import from barrel file
import { SocketManager, eventBus } from '../../lib/websocket';

// ❌ BAD: Import from internal file
import { SocketManager } from '../../lib/websocket/manager/socket-manager';
```

## Best Practices

### 1. One Component Per File

```typescript
// ✅ GOOD
// VoiceChat.tsx
export function VoiceChat() { /* ... */ }

// ConnectionStatus.tsx
export function ConnectionStatus() { /* ... */ }
```

### 2. Colocate Related Files

```
VoiceChat/
  VoiceChat.tsx          # Main component
  ConnectionStatus.tsx   # Used only by VoiceChat
  VoiceChat.test.tsx    # Tests (if added)
```

### 3. Keep Barrel Files Simple

```typescript
// ✅ GOOD: Simple re-exports
export { SocketManager } from './manager/socket-manager';
export { eventBus } from './events/event-bus';
export * from './types';

// ❌ BAD: Logic in barrel files
export const manager = new SocketManager(); // Don't instantiate here
```

### 4. Type Files

```typescript
// types.ts - Export types only
export interface ConnectionState { /* ... */ }
export type SocketEventHandler = { /* ... */ };

// No implementation in type files
```

## Dependencies

### Component Dependencies

```
components/
  └─→ hooks/           (useWebSocket, useAudioCapture, etc.)
  └─→ lib/websocket/   (types, event bus)
  └─→ lib/utils/       (logger)
```

### Hook Dependencies

```
hooks/
  └─→ lib/websocket/   (SocketManager, types)
  └─→ lib/audio/       (AudioCapture, AudioPlayback)
  └─→ lib/utils/       (logger)
```

### Lib Dependencies

```
lib/websocket/
  └─→ @Jatin5120/vantum-shared  (types, events)
  └─→ msgpackr                   (serialization)

lib/audio/
  └─→ lib/utils/                 (logger)
```

**Rule**: Dependencies should flow downward (components → hooks → lib).

## Configuration Files

### Root Level

```
vantum-frontend/
├── package.json           # Dependencies, scripts
├── tsconfig.json          # TypeScript config
├── tsconfig.app.json      # App-specific TS config
├── tsconfig.node.json     # Node-specific TS config
├── vite.config.ts         # Vite build config
├── tailwind.config.js     # TailwindCSS config
├── postcss.config.js      # PostCSS config
├── eslint.config.js       # ESLint config
├── .npmrc                 # npm/pnpm config
└── index.html             # HTML entry point
```

### Environment Variables

```
.env                  # Default environment variables
.env.local           # Local overrides (gitignored)
.env.production      # Production variables
```

**Usage**:
```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
```

## Build Output

```
dist/
├── index.html              # Built HTML
├── assets/                 # Bundled assets
│   ├── index-[hash].js    # Bundled JavaScript
│   └── index-[hash].css   # Bundled CSS
└── vite.svg               # Static assets
```

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Folder Structure Quick Reference](./folder-structure-quick-reference.md)
- [Best Practices](../development/best-practices.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

