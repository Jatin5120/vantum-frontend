# React Strict Mode Compatibility

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active - Critical Documentation

> **⚠️ CRITICAL**: This document explains a critical bug pattern and its solution. Required reading for all developers working on WebSocket/audio features.

## Overview

React Strict Mode in development runs effects twice to help detect side effects. This caused a critical bug where WebSocket event handlers were registered to one `SocketManager` instance, but messages were handled by a different instance (with no handlers).

**Symptoms**: `Unhandled event type` warnings, no audio playback, handlers appear registered but don't execute.

## The Problem

### React Strict Mode Behavior

In development mode with Strict Mode enabled (default in React 18), React:

1. Mounts component
2. Runs effects
3. **Unmounts component immediately**
4. **Remounts component**
5. **Runs effects again**

This is intentional to help detect cleanup issues.

### Our Bug

```typescript
// useWebSocket.ts (BUGGY VERSION)
useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  
  return () => {
    manager.destroy();
  };
}, []);

useEffect(() => {
  const manager = managerRef.current;
  // Register handlers to manager
  manager.registerHandler(eventType, handler);
}, [handlers]);
```

### What Happened

```
FIRST EFFECT RUN:
1. Create SocketManager A
2. managerRef.current = A
3. Handler registration effect runs
4. Handlers registered to Manager A ✅

STRICT MODE CLEANUP:
5. Manager A destroyed ❌
6. managerRef.current still points to A (now destroyed)

SECOND EFFECT RUN:
7. Create SocketManager B  
8. managerRef.current = B
9. Handler registration effect DOESN'T re-run (handlers haven't changed)
10. Handlers still on destroyed Manager A, NOT on active Manager B ❌

WHEN MESSAGE ARRIVES:
11. Manager B receives message
12. Manager B has NO handlers (handlers are on destroyed Manager A)
13. "Unhandled event type" warning 🔥
14. No audio playback 🔥
```

### Console Evidence

```
// Handlers registered successfully
✅ Registering handler: voicechat.response.chunk
📝 Handler registered. New total: 6 All handlers: [...]
🎉 Handler registration complete {registeredCount: 6}

// New manager created (Strict Mode second run)
🏗️ SocketManager constructed, instance: y15m5o

// Message arrives
🔍 HandlerRegistry.getHandler: voicechat.response.chunk Found: false Total handlers: 0
⚠️ Unhandled event type {"eventType":"voicechat.response.chunk","registeredHandlers":[]}
```

## The Solution

### Strategy

Force handler re-registration when a new `SocketManager` is created by clearing the handler tracking ref.

### Implementation

```typescript
// useWebSocket.ts (FIXED VERSION)
const registeredHandlersRef = useRef<Map<string, SocketEventHandler>>(new Map());

useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  registeredHandlersRef.current.clear(); // ← CRITICAL: Clear tracking ref
  
  return () => {
    manager.destroy();
  };
}, []);

useEffect(() => {
  const manager = managerRef.current;
  const currentHandlers = registeredHandlersRef.current;
  const newHandlers = options.handlers;
  
  // Register handlers
  for (const [eventType, handler] of newHandlers.entries()) {
    const existingHandler = currentHandlers.get(eventType);
    // Re-register if handler reference changed OR not in tracking ref
    if (existingHandler !== handler) {
      manager.registerHandler(eventType, handler);
      currentHandlers.set(eventType, handler);
    }
  }
}, [options.handlers]);
```

### How It Works

```
FIRST EFFECT RUN:
1. Create SocketManager A
2. managerRef.current = A
3. Clear registeredHandlersRef (empty map)
4. Handler registration effect runs
5. Handlers not in registeredHandlersRef (empty)
6. All handlers registered to Manager A ✅
7. Track in registeredHandlersRef

STRICT MODE CLEANUP:
8. Manager A destroyed
9. registeredHandlersRef still has old handler references

SECOND EFFECT RUN:
10. Create SocketManager B
11. managerRef.current = B
12. Clear registeredHandlersRef ← CRITICAL
13. Handler registration effect runs again
14. Handlers not in registeredHandlersRef (just cleared)
15. All handlers registered to Manager B ✅
16. Track in registeredHandlersRef

WHEN MESSAGE ARRIVES:
17. Manager B receives message
18. Manager B HAS handlers ✅
19. Handler executes ✅
20. Audio plays ✅
```

## Critical Implementation Details

### 1. Don't Use State in Effects

**❌ WRONG** - Causes cascading renders lint error:

```typescript
const [managerVersion, setManagerVersion] = useState(0);

useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  setManagerVersion(v => v + 1); // ← ERROR: setState in effect
  
  return () => manager.destroy();
}, []);
```

**✅ CORRECT** - Use ref clearing:

```typescript
const registeredHandlersRef = useRef<Map<string, SocketEventHandler>>(new Map());

useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  registeredHandlersRef.current.clear(); // ← Clean solution
  
  return () => manager.destroy();
}, []);
```

### 2. Handler Reference Comparison

The handler registration check `existingHandler !== handler` is critical:

```typescript
// This check ensures handlers are re-registered when:
// 1. Handler reference changes (normal React update)
// 2. Handler not in tracking ref (after clear())
if (existingHandler !== handler) {
  manager.registerHandler(eventType, handler);
  currentHandlers.set(eventType, handler);
}
```

### 3. Effect Dependencies

**Manager initialization effect** - No dependencies (runs once per mount):
```typescript
useEffect(() => {
  // Create manager, clear refs
}, []); // ← Empty deps
```

**Handler registration effect** - Depends on handlers:
```typescript
useEffect(() => {
  // Register handlers
}, [options.handlers]); // ← Re-run when handlers change
```

## Testing for Strict Mode Issues

### 1. Check Handler Registration

Look for this pattern in console:

```
✅ Handler registered (First mount)
🧹 Cleanup (Strict Mode unmount)
✅ Handler registered AGAIN (Second mount) ← Should happen!
```

If handlers are NOT registered twice, Strict Mode fix is not working.

### 2. Check Handler Execution

When messages arrive:

```
🔍 HandlerRegistry.getHandler: voicechat.response.chunk Found: true ✅
Total handlers: 6 ✅
```

If `Found: false` or `Total handlers: 0`, handlers are not on active manager.

### 3. Manual Test

```typescript
// Add to useWebSocket.ts temporarily
useEffect(() => {
  console.log('🏗️ Manager created, ID:', Math.random());
  const manager = new SocketManager();
  // ...
  
  return () => {
    console.log('🧹 Manager cleanup');
  };
}, []);
```

Should see:
```
🏗️ Manager created, ID: 0.123
🧹 Manager cleanup
🏗️ Manager created, ID: 0.456 ← Different ID = new instance
```

## Common Pitfalls

### Pitfall 1: Forgetting to Clear Refs

```typescript
// ❌ WRONG
useEffect(() => {
  const manager = new SocketManager();
  managerRef.current = manager;
  // Forgot to clear registeredHandlersRef!
  
  return () => manager.destroy();
}, []);
```

**Result**: Handlers not re-registered on second mount.

### Pitfall 2: Using Stale Manager Reference

```typescript
// ❌ WRONG
const manager = managerRef.current; // Captured outside effect

useEffect(() => {
  // Uses stale manager reference
  manager?.registerHandler(eventType, handler);
}, [handlers]);
```

**Result**: Handlers registered to old (destroyed) manager.

**✅ CORRECT**: Get fresh reference inside effect:

```typescript
useEffect(() => {
  const manager = managerRef.current; // Fresh reference
  manager?.registerHandler(eventType, handler);
}, [handlers]);
```

### Pitfall 3: Not Testing in Strict Mode

Always test with Strict Mode enabled (it's on by default in React 18+).

```tsx
// main.tsx - Strict Mode should be enabled
<React.StrictMode>
  <App />
</React.StrictMode>
```

## Production vs Development

### Development

- Strict Mode enabled (default)
- Effects run twice
- Our solution handles this gracefully

### Production

- Strict Mode disabled (React removes it)
- Effects run once
- Our solution still works (just does extra clear() that's harmless)

**Our solution works in both environments.**

## Related Patterns

This pattern applies to any resource that needs cleanup and recreation:

- ✅ WebSocket connections
- ✅ Audio contexts
- ✅ Timers/intervals
- ✅ Event subscriptions
- ✅ Any external system connection

### General Pattern

```typescript
const resourceRef = useRef<Resource | null>(null);
const trackingRef = useRef(new Map());

// Resource creation/cleanup
useEffect(() => {
  const resource = createResource();
  resourceRef.current = resource;
  trackingRef.current.clear(); // ← Clear tracking
  
  return () => {
    resource.cleanup();
  };
}, []);

// Resource configuration (runs after creation)
useEffect(() => {
  const resource = resourceRef.current;
  if (!resource) return;
  
  // Configure based on trackingRef
  // Will re-run after clear() in previous effect
}, [config]);
```

## Debugging Checklist

When encountering "Unhandled event type" errors:

- [ ] Check if React Strict Mode is enabled
- [ ] Verify handler registration logs show TWO registrations
- [ ] Check manager instance IDs are different between runs
- [ ] Verify `registeredHandlersRef.current.clear()` is called
- [ ] Check handler registration effect runs after manager creation
- [ ] Verify no `setState` calls in effects
- [ ] Check `managerRef.current` is accessed inside effects, not outside

## References

- [React Docs: Strict Mode](https://react.dev/reference/react/StrictMode)
- [React Docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Architecture Overview](./overview.md)
- [useWebSocket Hook Documentation](../hooks/useWebSocket.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

**⚠️ This is critical documentation. All developers must understand this pattern.**

