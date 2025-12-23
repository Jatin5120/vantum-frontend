# Development Setup Guide

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active

## Prerequisites

### Required Software

- **Node.js**: v18 or higher
- **pnpm**: v8 or higher (recommended) or npm
- **Git**: Latest version
- **Code Editor**: VS Code recommended

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Error Lens

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd vantum-frontend
```

### 2. Install Dependencies

```bash
pnpm install
# or
npm install
```

### 3. Configure Environment

Create `.env.local` file:

```bash
# WebSocket server URL
VITE_WS_URL=ws://localhost:3001/ws
```

### 4. Install Shared Package

The frontend uses `@Jatin5120/vantum-shared` for shared types.

#### Option A: From GitHub Packages (Production)

Create `.npmrc`:
```
@Jatin5120:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Set GitHub token:
```bash
export GITHUB_TOKEN=your_github_token
```

Install:
```bash
pnpm install
```

#### Option B: Local Development

If developing locally with vantum-shared:

```bash
# In vantum-shared
cd ../vantum-shared
pnpm build

# In vantum-frontend
cd ../vantum-frontend
pnpm add file:../vantum-shared
```

## Running the Application

### Development Server

```bash
pnpm dev
```

Opens at: `http://localhost:5173/`

**Features**:
- Hot Module Replacement (HMR)
- Fast refresh
- Source maps
- React Strict Mode enabled

### Build for Production

```bash
pnpm build
```

Output: `dist/` directory

### Preview Production Build

```bash
pnpm preview
```

Opens at: `http://localhost:4173/`

## Development Workflow

### 1. Start Backend Server

The frontend requires the backend WebSocket server:

```bash
cd ../vantum-backend
pnpm dev
```

Backend runs at: `ws://localhost:3001/ws`

### 2. Start Frontend Dev Server

```bash
cd ../vantum-frontend
pnpm dev
```

Frontend runs at: `http://localhost:5173/`

### 3. Development Cycle

```
1. Make code changes
2. Save file
3. Vite HMR updates browser automatically
4. Test in browser
5. Check console for errors
6. Repeat
```

## Project Scripts

### Available Scripts

```json
{
  "dev": "vite",                    // Start dev server
  "build": "tsc -b && vite build",  // Build for production
  "preview": "vite preview",        // Preview production build
  "lint": "eslint .",               // Run linter
}
```

### Running Scripts

```bash
pnpm dev      # Development server
pnpm build    # Production build
pnpm preview  # Preview build
pnpm lint     # Run linter
```

## Configuration

### TypeScript Configuration

**`tsconfig.json`**: Base configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

**`tsconfig.app.json`**: App-specific config (extends base)

### Vite Configuration

**`vite.config.ts`**:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

### TailwindCSS Configuration

**`tailwind.config.js`**:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## Environment Variables

### Available Variables

```bash
# WebSocket server URL
VITE_WS_URL=ws://localhost:3001/ws

# Log level (optional)
VITE_LOG_LEVEL=debug
```

### Usage in Code

```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
```

**Note**: Vite requires `VITE_` prefix for env vars to be exposed to client.

## Browser Requirements

### Supported Browsers

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions

### Required Web APIs

- WebSocket API
- Web Audio API (AudioContext)
- MediaDevices API (getUserMedia)
- ScriptProcessorNode (deprecated but required)

See [Browser Compatibility](../reference/browser-compatibility.md) for details.

## Troubleshooting

### Issue: Dependencies Not Installing

**Solution**:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: Port Already in Use

**Solution**:
```bash
# Change port in vite.config.ts
server: {
  port: 5174, // Different port
}
```

Or kill process on port 5173:
```bash
lsof -ti:5173 | xargs kill
```

### Issue: WebSocket Connection Failed

**Symptoms**: "WebSocket connection failed" error

**Solutions**:
1. Verify backend is running: `http://localhost:3001/health`
2. Check WebSocket URL in `.env.local`
3. Check browser console for errors
4. Verify firewall/network settings

### Issue: Microphone Permission Denied

**Symptoms**: "Microphone permission denied" error

**Solutions**:
1. Check browser permissions (click lock icon in address bar)
2. Allow microphone access
3. Reload page
4. Try different browser

### Issue: No Audio Playback

**Symptoms**: Audio chunks received but no sound

**Solutions**:
1. Check browser console for errors
2. Verify AudioContext is not suspended
3. Check system volume/mute
4. Try clicking page first (autoplay policy)
5. See [Audio Playback Troubleshooting](../audio/audio-playback.md#common-issues-and-solutions)

### Issue: React Strict Mode Warnings

**Symptoms**: "Unhandled event type" warnings in console

**Solution**: See [React Strict Mode Compatibility](../architecture/react-strict-mode.md)

## Development Tips

### 1. Use React DevTools

Install React DevTools browser extension for:
- Component tree inspection
- Props/state inspection
- Performance profiling

### 2. Enable Verbose Logging

```typescript
// Temporarily change log level
logger.setLevel('debug');
```

### 3. Network Inspection

Use browser DevTools Network tab:
- Filter by "WS" to see WebSocket messages
- Inspect message payloads
- Check connection timing

### 4. Hot Reload Issues

If HMR breaks:
```bash
# Hard refresh browser
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

# Or restart dev server
# Ctrl+C to stop
pnpm dev
```

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Best Practices](./best-practices.md)
- [Folder Structure](../code/folder-structure.md)
- [Backend Setup Guide](../../../vantum-backend/docs/development/setup.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Maintained By**: Frontend Team

