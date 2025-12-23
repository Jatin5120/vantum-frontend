# ConnectionStatus Component

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

## Overview

`ConnectionStatus` is a presentational component that displays the WebSocket connection status and any error messages.

**Location**: `src/components/VoiceChat/ConnectionStatus.tsx`

## Component API

```typescript
interface ConnectionStatusProps {
  state: ConnectionState;
  error?: string;
}

export function ConnectionStatus({ state, error }: ConnectionStatusProps): JSX.Element
```

## Props

### state

**Type**: `ConnectionState`

**Values**:
- `'disconnected'`: Not connected
- `'connecting'`: Connection in progress
- `'connected'`: Successfully connected
- `'error'`: Connection error

**Required**: Yes

### error

**Type**: `string | undefined`

**Description**: Error message to display (if any)

**Required**: No

## Usage

```typescript
import { ConnectionStatus } from './ConnectionStatus';

function VoiceChat() {
  const { connectionState } = useWebSocket();
  const [error, setError] = useState<string | null>(null);
  
  return (
    <ConnectionStatus 
      state={connectionState} 
      error={error || undefined} 
    />
  );
}
```

## Visual States

### Disconnected

```
Status: Disconnected
[Gray indicator]
```

### Connecting

```
Status: Connecting...
[Yellow indicator, pulsing]
```

### Connected

```
Status: Connected
[Green indicator]
```

### Error

```
Status: Error
[Red indicator]
Error: Connection failed
```

## Styling

Uses TailwindCSS utility classes for responsive, accessible design:

```tsx
<div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
  {/* Status indicator */}
  <div className={`w-3 h-3 rounded-full ${statusColor}`} />
  
  {/* Status text */}
  <span className="font-medium text-gray-900 dark:text-white">
    {statusText}
  </span>
</div>

{/* Error message */}
{error && (
  <div className="mt-2 p-3 bg-red-100 dark:bg-red-900 rounded text-red-800 dark:text-red-200">
    {error}
  </div>
)}
```

## Related Documentation

- [VoiceChat Component](./VoiceChat.md)
- [useWebSocket Hook](../hooks/useWebSocket.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

