# Frontend Documentation Index

This directory contains all documentation for the Vantum frontend. Documents are organized following DRY (Don't Repeat Yourself) principles and grouped by category.

## Documentation Structure

```
docs/
├── README.md                    # This file - Documentation index
├── TEMPLATE.md                  # Documentation template for new docs
│
├── architecture/                # Architecture & Design
│   ├── overview.md              # System architecture overview
│   ├── state-management.md      # State management patterns
│   └── react-strict-mode.md     # React Strict Mode compatibility
│
├── components/                  # Component Documentation
│   ├── VoiceChat.md            # Main VoiceChat component
│   └── ConnectionStatus.md     # ConnectionStatus component
│
├── hooks/                       # Custom Hooks Documentation
│   ├── useWebSocket.md         # WebSocket connection hook
│   ├── useAudioCapture.md      # Audio capture hook
│   └── useAudioPlayback.md     # Audio playback hook
│
├── websocket/                   # WebSocket Client
│   ├── client-architecture.md   # Client architecture
│   ├── socket-manager.md        # SocketManager implementation
│   └── handler-registry.md      # Event handler system
│
├── audio/                       # Audio System
│   ├── audio-capture.md        # Audio capture implementation
│   └── audio-playback.md       # Audio playback implementation
│
├── development/                 # Development Guides
│   ├── setup.md                # Development setup
│   └── best-practices.md       # React & TypeScript best practices
│
├── code/                        # Code Organization
│   ├── folder-structure.md     # Detailed folder structure
│   └── folder-structure-quick-reference.md
│
└── reference/                   # Reference Materials
    └── browser-compatibility.md # Browser compatibility notes
```

## Primary Documents

### 🏗️ Architecture & Design

#### [Architecture Overview](architecture/overview.md)

**System Architecture** - React application architecture and design patterns

- Component hierarchy
- Data flow patterns
- WebSocket integration
- Audio system architecture

#### [State Management](architecture/state-management.md)

**State Management Patterns** - How state is managed across the application

- Component state
- WebSocket state
- Audio state
- Event-driven architecture

#### [React Strict Mode Compatibility](architecture/react-strict-mode.md)

**Critical: React Strict Mode** - How we handle React Strict Mode in development

- Double-effect execution
- Handler registration strategy
- Common pitfalls and solutions

### 🧩 Component Documentation

#### [VoiceChat Component](components/VoiceChat.md)

**Main Application Component** - Core voice chat interface

- Component structure
- Event handlers
- State management
- Integration points

#### [ConnectionStatus Component](components/ConnectionStatus.md)

**Status Display** - WebSocket connection status display

- Props interface
- State visualization
- Error handling

### 🎣 Custom Hooks Documentation

#### [useWebSocket Hook](hooks/useWebSocket.md)

**WebSocket Connection Management** - Custom hook for WebSocket connections

- Connection lifecycle
- Handler registration
- React Strict Mode compatibility
- Message sending/receiving

#### [useAudioCapture Hook](hooks/useAudioCapture.md)

**Audio Capture** - Custom hook for microphone audio capture

- Audio capture initialization
- PCM audio streaming
- Permission handling
- Resource cleanup

#### [useAudioPlayback Hook](hooks/useAudioPlayback.md)

**Audio Playback** - Custom hook for audio playback

- AudioContext management
- Chunk queueing
- Playback control

### 🔌 WebSocket Client

#### [Client Architecture](websocket/client-architecture.md)

**WebSocket Architecture** - WebSocket client architecture overview

- SocketClient
- SocketManager
- HandlerRegistry
- RequestTracker

#### [SocketManager](websocket/socket-manager.md)

**Core WebSocket Manager** - High-level WebSocket API

- Connection management
- Event routing
- ACK tracking

#### [Handler Registry](websocket/handler-registry.md)

**Event Handler System** - Event handler registration and routing

- Handler registration
- Event routing
- Error handling

### 🎵 Audio System

#### [Audio Capture](audio/audio-capture.md)

**Microphone Audio Capture** - Browser audio capture implementation

- ScriptProcessorNode (deprecated but required)
- Int16 PCM encoding
- Chunk streaming

#### [Audio Playback](audio/audio-playback.md)

**Audio Playback System** - AudioContext-based playback

- AudioBuffer creation
- Queue management
- Buffer handling (MessagePack compatibility)

### 💻 Development Guides

#### [Setup Guide](development/setup.md)

**Development Setup** - Getting started with development

- Prerequisites
- Installation
- Environment configuration
- Running the app

#### [Best Practices](development/best-practices.md)

**React & TypeScript Best Practices** - Coding standards and patterns

- Component patterns
- Hook patterns
- TypeScript usage
- Performance optimization

### 📁 Code Organization

#### [Folder Structure Documentation](code/folder-structure.md)

**Code Organization** - Detailed folder structure and conventions

- Directory structure
- Module organization
- Import patterns
- Best practices

#### [Folder Structure Quick Reference](code/folder-structure-quick-reference.md)

**Quick Lookup** - Quick reference for folder structure

- Directory tree
- Import examples
- Key conventions

### 📚 Reference Materials

#### [Browser Compatibility](reference/browser-compatibility.md)

**Browser Support** - Browser compatibility and requirements

- Supported browsers
- Required Web APIs
- Known issues
- Fallback strategies

## Documentation Principles

### DRY (Don't Repeat Yourself)

1. **Single Source of Truth**: Each concept documented in one place
2. **Cross-References**: Docs link to each other instead of duplicating
3. **Consistent Terminology**: Use same terms throughout all docs
4. **Avoid Duplication**: Link to backend protocol docs for shared concepts

### Document Hierarchy

```
architecture/overview.md (System Overview)
    ↑
    ├── components/*.md (Component docs reference architecture)
    ├── hooks/*.md (Hook docs reference architecture)
    ├── websocket/*.md (WebSocket docs reference architecture)
    ├── audio/*.md (Audio docs reference architecture)
    └── README.md (Links to all docs)
```

## Quick Links

- **New to the project?** Start with [Setup Guide](development/setup.md)
- **Understanding architecture?** Read [Architecture Overview](architecture/overview.md)
- **Working with WebSocket?** See [Client Architecture](websocket/client-architecture.md)
- **Audio system?** Read [Audio Capture](audio/audio-capture.md) and [Audio Playback](audio/audio-playback.md)
- **React Strict Mode issues?** Read [React Strict Mode Compatibility](architecture/react-strict-mode.md)
- **Protocol details?** See [Backend WebSocket Protocol](../../vantum-backend/docs/protocol/websocket-protocol.md)

## Contributing to Documentation

When updating documentation:

1. **Architecture Changes**: Update `architecture/overview.md` first
2. **Cross-References**: Link to related docs, don't duplicate
3. **Code Examples**: Keep examples minimal and focused
4. **Consistency**: Use consistent terminology and naming conventions
5. **Folder Structure**: Keep related docs in appropriate folders
6. **New Docs**: Use [TEMPLATE.md](TEMPLATE.md) as a starting point
7. **Protocol Changes**: Update backend protocol doc, reference from frontend

## Shared Documentation

The WebSocket protocol is documented in the backend:

- **Protocol Specification**: `../../vantum-backend/docs/protocol/websocket-protocol.md`
- **Quick Reference**: `../../vantum-backend/docs/protocol/websocket-quick-reference.md`

Frontend docs reference the backend protocol docs for all protocol-level details.

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-23  
**Status**: Active
