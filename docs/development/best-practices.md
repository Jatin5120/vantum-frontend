# React & TypeScript Best Practices

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

> **Note**: These are the coding standards and patterns used in the Vantum frontend.

## React Best Practices

### 1. Component Patterns

#### Functional Components Only

```typescript
// ✅ GOOD: Functional component
export function VoiceChat() {
  return <div>...</div>;
}

// ❌ BAD: Class component (avoid)
export class VoiceChat extends React.Component {
  render() {
    return <div>...</div>;
  }
}
```

#### Props Interface

```typescript
// ✅ GOOD: Explicit props interface
interface ConnectionStatusProps {
  state: ConnectionState;
  error?: string;
}

export function ConnectionStatus({ state, error }: ConnectionStatusProps) {
  return <div>...</div>;
}

// ❌ BAD: Inline props type
export function ConnectionStatus({ state, error }: { state: string; error?: string }) {
  return <div>...</div>;
}
```

### 2. Hook Usage

#### Custom Hooks for Logic

```typescript
// ✅ GOOD: Extract logic to custom hook
function useVoiceChat() {
  const [isRecording, setIsRecording] = useState(false);
  const { connect, disconnect } = useWebSocket();
  
  const startRecording = useCallback(() => {
    // Complex logic
  }, []);
  
  return { isRecording, startRecording };
}

// Component stays clean
function VoiceChat() {
  const { isRecording, startRecording } = useVoiceChat();
  return <button onClick={startRecording}>Record</button>;
}
```

#### Hook Dependencies

```typescript
// ✅ GOOD: Include all dependencies
useEffect(() => {
  if (isConnected) {
    sendMessage();
  }
}, [isConnected, sendMessage]); // All used values

// ❌ BAD: Missing dependencies
useEffect(() => {
  if (isConnected) {
    sendMessage();
  }
}, []); // Missing isConnected, sendMessage
```

#### Callback Memoization

```typescript
// ✅ GOOD: Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);

// ❌ BAD: Inline callback (new reference every render)
<button onClick={() => doSomething(value)}>Click</button>
```

### 3. State Management

#### State Colocation

```typescript
// ✅ GOOD: State close to usage
function ConnectionStatus({ state }: Props) {
  const [expanded, setExpanded] = useState(false); // Only used here
  
  return (
    <div onClick={() => setExpanded(!expanded)}>
      {expanded && <Details state={state} />}
    </div>
  );
}

// ❌ BAD: State in parent when not needed
function Parent() {
  const [expanded, setExpanded] = useState(false); // Only used in child
  return <ConnectionStatus expanded={expanded} setExpanded={setExpanded} />;
}
```

#### Derived State

```typescript
// ✅ GOOD: Derive, don't duplicate
const isConnected = connectionState === 'connected';

// ❌ BAD: Duplicate state
const [isConnected, setIsConnected] = useState(false);
useEffect(() => {
  setIsConnected(connectionState === 'connected');
}, [connectionState]);
```

#### Functional Updates

```typescript
// ✅ GOOD: Functional update
setCount(prev => prev + 1);

// ❌ BAD: Direct state access (can be stale)
setCount(count + 1);
```

### 4. Effect Patterns

#### Cleanup Functions

```typescript
// ✅ GOOD: Always cleanup
useEffect(() => {
  const manager = new SocketManager();
  
  return () => {
    manager.destroy(); // Cleanup
  };
}, []);

// ❌ BAD: No cleanup (resource leak)
useEffect(() => {
  const manager = new SocketManager();
  // No cleanup!
}, []);
```

#### Avoid setState in Effects

```typescript
// ✅ GOOD: Sync external state to React
useEffect(() => {
  const unsubscribe = manager.onStateChange((state) => {
    setConnectionState(state); // OK: Syncing external state
  });
  
  return unsubscribe;
}, []);

// ❌ BAD: Synchronous setState in effect
useEffect(() => {
  setManagerVersion(v => v + 1); // Causes cascading renders
}, []);
```

### 5. Refs vs State

#### When to Use Refs

```typescript
// ✅ GOOD: Ref for non-visual values
const managerRef = useRef<SocketManager | null>(null);
const playbackRef = useRef<AudioPlayback | null>(null);

// Values don't trigger re-renders (good for instances)
```

#### When to Use State

```typescript
// ✅ GOOD: State for visual values
const [connectionState, setConnectionState] = useState('disconnected');
const [error, setError] = useState<string | null>(null);

// Values trigger re-renders (good for UI)
```

## TypeScript Best Practices

### 1. Type Annotations

#### Explicit Return Types

```typescript
// ✅ GOOD: Explicit return type
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ BAD: Inferred return type (less clear)
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

#### Interface vs Type

```typescript
// ✅ GOOD: Interface for objects
interface User {
  id: string;
  name: string;
}

// ✅ GOOD: Type for unions/primitives
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type ID = string | number;

// ❌ BAD: Type for simple objects (prefer interface)
type User = {
  id: string;
  name: string;
};
```

### 2. Type Safety

#### Avoid `any`

```typescript
// ✅ GOOD: Proper typing
function handleMessage(message: UnpackedMessage): void {
  const payload = message.payload as ResponseChunkPayload;
}

// ❌ BAD: Using any
function handleMessage(message: any): void {
  const payload = message.payload;
}
```

#### Type Guards

```typescript
// ✅ GOOD: Type guard
function isResponseChunk(payload: unknown): payload is ResponseChunkPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'audio' in payload &&
    'utteranceId' in payload
  );
}

if (isResponseChunk(payload)) {
  // TypeScript knows payload is ResponseChunkPayload
  console.log(payload.audio);
}
```

#### Strict Null Checks

```typescript
// ✅ GOOD: Handle null/undefined
const sessionId = manager.getSessionId();
if (sessionId) {
  sendMessage(sessionId); // TypeScript knows sessionId is string
}

// ❌ BAD: Assume non-null
const sessionId = manager.getSessionId();
sendMessage(sessionId!); // Dangerous! May be undefined
```

### 3. Generic Types

```typescript
// ✅ GOOD: Generic for reusability
async function sendMessagePack<T>(event: EventMessage<T>): Promise<string> {
  const data = pack(event);
  await client.send(data);
  return event.eventId;
}

// Usage with type safety
await sendMessagePack<AudioStartPayload>({
  eventType: VOICECHAT_EVENTS.AUDIO_START,
  payload: { samplingRate: 16000 }, // Type-checked
});
```

## Code Organization

### 1. File Structure

```typescript
// Order: imports → types → component → exports

// 1. External imports
import { useState, useCallback } from 'react';
import { pack } from 'msgpackr';

// 2. Shared package
import { VOICECHAT_EVENTS } from '@Jatin5120/vantum-shared';

// 3. Internal imports
import { SocketManager } from '../../lib/websocket';
import { logger } from '../../lib/utils/logger';

// 4. Local imports
import { ConnectionStatus } from './ConnectionStatus';

// 5. Types (if not in separate file)
interface Props {
  // ...
}

// 6. Component
export function VoiceChat({ }: Props) {
  // ...
}
```

### 2. Component Structure

```typescript
export function MyComponent() {
  // 1. Hooks (in order: state, refs, context, custom hooks)
  const [state, setState] = useState();
  const ref = useRef();
  const { value } = useCustomHook();
  
  // 2. Derived values
  const derivedValue = useMemo(() => compute(state), [state]);
  
  // 3. Callbacks
  const handleClick = useCallback(() => {
    // ...
  }, [dependencies]);
  
  // 4. Effects
  useEffect(() => {
    // ...
  }, [dependencies]);
  
  // 5. Render
  return (
    <div>...</div>
  );
}
```

### 3. Custom Hook Structure

```typescript
export function useCustomHook(options: Options) {
  // 1. State and refs
  const [state, setState] = useState();
  const ref = useRef();
  
  // 2. Effects
  useEffect(() => {
    // Setup and cleanup
  }, []);
  
  // 3. Callbacks
  const doSomething = useCallback(() => {
    // ...
  }, [dependencies]);
  
  // 4. Return API
  return {
    state,
    doSomething,
  };
}
```

## Performance Optimization

### 1. Memoization

#### useMemo for Expensive Computations

```typescript
// ✅ GOOD: Memoize expensive computation
const handlers = useMemo(() => {
  const map = new Map();
  // Expensive: Create multiple closures
  map.set('event1', { handle: async () => { /* ... */ } });
  map.set('event2', { handle: async () => { /* ... */ } });
  return map;
}, [dependencies]);

// ❌ BAD: Recreate every render
const handlers = new Map(); // New map every render!
```

#### useCallback for Stable References

```typescript
// ✅ GOOD: Stable callback reference
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);

// Used in dependency array safely
useEffect(() => {
  // ...
}, [handleClick]); // Won't cause infinite loop
```

### 2. Avoid Unnecessary Re-renders

```typescript
// ✅ GOOD: Memoize child component
const MemoizedChild = memo(Child);

function Parent() {
  return <MemoizedChild data={data} />;
}

// Use when child is expensive to render
```

### 3. Lazy Initialization

```typescript
// ✅ GOOD: Lazy initialization
const [state] = useState(() => {
  return expensiveComputation(); // Only runs once
});

// ❌ BAD: Runs every render
const [state] = useState(expensiveComputation()); // Runs every render!
```

## Error Handling

### 1. Try/Catch in Async Operations

```typescript
// ✅ GOOD: Handle errors
const handleStartRecording = useCallback(async () => {
  try {
    await startCapture();
    setIsRecording(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setError(message);
    logger.error('Failed to start recording', error);
  }
}, [startCapture]);
```

### 2. Error Boundaries (Future)

```typescript
// Future: Add error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    logger.error('React error boundary caught error', error, errorInfo);
  }
  
  render() {
    return this.props.children;
  }
}
```

### 3. Graceful Degradation

```typescript
// ✅ GOOD: Fallback UI
{error && (
  <div className="error-message">
    {error}
  </div>
)}

{!hasPermission && (
  <div className="warning-message">
    Microphone permission required
  </div>
)}
```

## Testing Best Practices (Future)

### 1. Component Testing

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('VoiceChat', () => {
  it('connects when Connect button clicked', async () => {
    render(<VoiceChat />);
    
    const button = screen.getByText('Connect');
    await userEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  });
});
```

### 2. Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';

describe('useWebSocket', () => {
  it('updates connection state', async () => {
    const { result } = renderHook(() => useWebSocket());
    
    act(() => {
      result.current.connect();
    });
    
    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });
  });
});
```

## Code Style

### 1. Naming Conventions

```typescript
// Components: PascalCase
export function VoiceChat() {}

// Hooks: useCamelCase
export function useWebSocket() {}

// Functions: camelCase
function handleConnect() {}

// Constants: UPPER_SNAKE_CASE
const DEFAULT_SAMPLE_RATE = 16000;

// Types/Interfaces: PascalCase
interface ConnectionState {}
type EventHandler = () => void;
```

### 2. File Naming

```
PascalCase.tsx     → Components
useCamelCase.ts    → Hooks
kebab-case.ts      → Classes/utilities
types.ts           → Type definitions
constants.ts       → Constants
index.ts           → Barrel files
```

### 3. Import Organization

```typescript
// 1. React
import { useState, useEffect } from 'react';

// 2. External libraries
import { pack, unpack } from 'msgpackr';

// 3. Shared package
import { VOICECHAT_EVENTS } from '@Jatin5120/vantum-shared';

// 4. Internal lib
import { SocketManager } from '../../lib/websocket';
import { logger } from '../../lib/utils/logger';

// 5. Local
import { ConnectionStatus } from './ConnectionStatus';
```

## Common Pitfalls

### 1. Stale Closures

```typescript
// ❌ BAD: Stale closure
const handlers = useMemo(() => {
  return {
    handle: async () => {
      console.log(count); // Captures count at creation time
    },
  };
}, []); // count not in deps!

// ✅ GOOD: Fresh closure
const handlers = useMemo(() => {
  return {
    handle: async () => {
      console.log(count); // Always uses current count
    },
  };
}, [count]); // count in deps
```

### 2. Effect Dependency Arrays

```typescript
// ❌ BAD: Disabled exhaustive-deps
useEffect(() => {
  doSomething(value);
}, []); // eslint-disable-next-line react-hooks/exhaustive-deps

// ✅ GOOD: Proper dependencies
useEffect(() => {
  doSomething(value);
}, [value]);
```

### 3. Ref Access in Render

```typescript
// ❌ BAD: Accessing ref during render
function Component() {
  const ref = useRef(0);
  console.log(ref.current); // Don't access during render
  return <div />;
}

// ✅ GOOD: Access in effect or callback
function Component() {
  const ref = useRef(0);
  
  useEffect(() => {
    console.log(ref.current); // OK in effect
  }, []);
  
  const handleClick = () => {
    console.log(ref.current); // OK in callback
  };
  
  return <button onClick={handleClick}>Click</button>;
}
```

### 4. Inline Object/Array in Dependencies

```typescript
// ❌ BAD: Inline object (new reference every render)
useEffect(() => {
  doSomething({ key: 'value' });
}, [{ key: 'value' }]); // New object every render!

// ✅ GOOD: Stable reference
const config = useMemo(() => ({ key: 'value' }), []);
useEffect(() => {
  doSomething(config);
}, [config]);
```

## React Strict Mode

### Understanding Strict Mode

React Strict Mode (enabled by default) runs effects twice in development:

```typescript
useEffect(() => {
  console.log('Effect run');
  return () => console.log('Cleanup');
}, []);

// Development output:
// Effect run
// Cleanup
// Effect run

// Production output:
// Effect run
```

### Writing Strict Mode Compatible Code

```typescript
// ✅ GOOD: Idempotent effect
useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  
  return () => {
    manager.destroy(); // Cleanup
  };
}, []);

// Running twice is safe:
// 1. Create A, cleanup A
// 2. Create B (B is active)
```

See [React Strict Mode Compatibility](../architecture/react-strict-mode.md) for critical details.

## Accessibility

### 1. Semantic HTML

```tsx
// ✅ GOOD: Semantic elements
<button onClick={handleClick}>Connect</button>
<main>
  <h1>Voice Chat</h1>
  <section>...</section>
</main>

// ❌ BAD: Divs for everything
<div onClick={handleClick}>Connect</div>
```

### 2. ARIA Labels

```tsx
// ✅ GOOD: Descriptive labels
<button
  onClick={handleConnect}
  aria-label="Connect to voice chat"
  disabled={!sessionId}
  title={!sessionId ? "Waiting for session..." : undefined}
>
  Connect
</button>
```

### 3. Keyboard Navigation

Ensure all interactive elements are keyboard accessible (buttons, not divs with onClick).

## Security Best Practices

### 1. Input Sanitization

```typescript
// ✅ GOOD: Validate inputs
if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
  throw new Error('Invalid sample rate');
}

// ✅ GOOD: Sanitize strings
const sanitized = userInput.trim().slice(0, 1000);
```

### 2. Avoid Dangerous HTML

```tsx
// ❌ BAD: dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ GOOD: Use text content
<div>{userContent}</div>
```

### 3. Secure WebSocket

```typescript
// Production: Use WSS (secure WebSocket)
const WS_URL = import.meta.env.PROD 
  ? 'wss://api.vantum.com/ws'  // Secure
  : 'ws://localhost:3001/ws';   // Development
```

## Documentation

### 1. Component Documentation

```typescript
/**
 * VoiceChat Component
 * 
 * Main voice chat interface that handles:
 * - WebSocket connection management
 * - Audio capture and playback
 * - User interaction
 * 
 * @example
 * ```tsx
 * <VoiceChat />
 * ```
 */
export function VoiceChat() {
  // ...
}
```

### 2. Function Documentation

```typescript
/**
 * Convert Int16 PCM audio to Float32 format
 * 
 * @param int16Data - Int16 audio data
 * @returns Float32 audio data in range [-1.0, 1.0]
 */
function convertToFloat32(int16Data: Int16Array): Float32Array {
  // ...
}
```

### 3. Inline Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// CRITICAL: Create a copy to avoid MessagePack buffer reuse issues
audioData = new Uint8Array(rawAudio);

// ❌ BAD: Obvious comment
// Create a new Uint8Array
audioData = new Uint8Array(rawAudio);
```

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [State Management](../architecture/state-management.md)
- [React Strict Mode Compatibility](../architecture/react-strict-mode.md)
- [Folder Structure](../code/folder-structure.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

