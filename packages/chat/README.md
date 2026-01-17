# @strixun/chat

> P2P Encrypted Chat with Blockchain-Style Persistence

A framework-agnostic P2P chat library with end-to-end encryption, distributed storage, and cryptographic integrity verification.

## Features

- **End-to-End Encryption**: AES-256-GCM with PBKDF2 key derivation
- **P2P Communication**: WebRTC data channels for direct peer messaging
- **Blockchain-Style Storage**: Messages form a hash-linked chain for tamper detection
- **Distributed Persistence**: Chat history replicated across participating peers
- **Gap Detection**: Clear UX for missing messages with reason attribution
- **HMAC Integrity**: HMAC-SHA256 signatures on every message
- **Merkle Verification**: Chunk-level integrity with Merkle tree roots
- **Framework Agnostic**: Core library works with any framework
- **React Components**: Drop-in UI components for React apps

## Installation

```bash
pnpm add @strixun/chat
```

## Quick Start

### React

```tsx
import { ChatClient } from '@strixun/chat/react';
import { createChatStore } from '@strixun/chat/zustand';

// Create the store
const useChatStore = createChatStore({
  signalingBaseUrl: 'https://chat-api.idling.app',
});

function MyChat() {
  return (
    <ChatClient
      useChatStore={useChatStore}
      userId={user.id}
      userName={user.name}
      showRoomList={true}
      showRoomCreator={true}
    />
  );
}
```

### Vanilla JavaScript

```typescript
import { SecureRoomManager } from '@strixun/chat/core';

const manager = new SecureRoomManager({
  signalingBaseUrl: 'https://chat-api.idling.app',
  userId: 'user_123',
  userName: 'Alice',
  getAuthToken: async () => localStorage.getItem('token') || '',
  onMessage: (message) => {
    console.log('New message:', message.content);
  },
  onHistoryLoaded: (messages) => {
    console.log('History loaded:', messages.length, 'messages');
  },
});

// Create a room
const room = await manager.createRoom('My Chat Room');

// Send a message
await manager.sendMessage('Hello, world!');

// Clean up
manager.destroy();
```

## Architecture

### Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Message Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │  User   │───▶│  Encrypt    │───▶│   Sign      │              │
│  │ Types   │    │ (AES-256)   │    │ (HMAC-256)  │              │
│  └─────────┘    └─────────────┘    └─────────────┘              │
│                                           │                      │
│                                           ▼                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Hash Chain (Block)                      │        │
│  │  ┌─────────┬──────────┬─────────┬──────────┐        │        │
│  │  │  Hash   │  Prev    │  Msg    │  Sig     │        │        │
│  │  │ a7f3... │  e9d2... │ {...}   │ hmac...  │        │        │
│  │  └─────────┴──────────┴─────────┴──────────┘        │        │
│  └─────────────────────────────────────────────────────┘        │
│                       │                                          │
│          ┌────────────┼────────────┐                            │
│          ▼            ▼            ▼                            │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│    │  Peer A  │ │  Peer B  │ │  Peer C  │                       │
│    │(IndexedDB)│ │(IndexedDB)│ │(FileSystem)│                    │
│    └──────────┘ └──────────┘ └──────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Encryption

1. **Room Key Generation**: 256-bit random key generated when room is created
2. **Key Encryption**: Room key encrypted with creator's auth token
3. **Key Sharing**: When peers join, room key is re-encrypted for them
4. **Message Encryption**: Each message encrypted with AES-256-GCM using room key
5. **Unique IVs**: Every encryption uses a fresh IV and salt

### Integrity Verification

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integrity Model                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Message Level:                                                  │
│  ├── HMAC-SHA256 signature (authenticity)                       │
│  ├── Content hash (integrity)                                   │
│  └── Previous hash link (chain integrity)                       │
│                                                                  │
│  Chunk Level:                                                    │
│  ├── Merkle root of block hashes                                │
│  └── Peer confirmation tracking                                 │
│                                                                  │
│  Chain Level:                                                    │
│  ├── Genesis block hash                                         │
│  ├── Latest block hash                                          │
│  └── Gap detection with reason attribution                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Protocol

When a peer joins or reconnects:

1. **SYNC_REQUEST**: Peer sends last known block number
2. **SYNC_RESPONSE**: Other peers respond with missed blocks
3. **Verification**: Each block's signature and hash chain verified
4. **Import**: Valid blocks imported, invalid ones marked
5. **Gap Detection**: Missing sequences identified with reasons

## API Reference

### Core Exports

```typescript
import {
  // Room Management
  RoomManager,
  SecureRoomManager,
  
  // WebRTC
  WebRTCService,
  
  // Storage
  BlockchainStorage,
  openDatabase,
  
  // Encryption
  RoomKeyManager,
  
  // Sync
  SyncProtocol,
  
  // Types
  ChatMessage,
  RoomMetadata,
  MessageBlock,
  ChainState,
} from '@strixun/chat/core';
```

### React Components

```typescript
import {
  // Main Chat UI
  ChatClient,
  ChatMessage,
  ChatInput,
  RoomList,
  RoomCreator,
  
  // Integrity & Status
  IntegrityBadge,
  PeerCount,
  GapWarning,
  
  // Settings
  StoragePicker,
} from '@strixun/chat/react';
```

### Zustand Adapter

```typescript
import { createChatStore } from '@strixun/chat/zustand';

const useChatStore = createChatStore({
  signalingBaseUrl: 'https://chat-api.idling.app',
});
```

## Storage Options

Users can choose where their encrypted chat history is stored:

- **IndexedDB** (default): Browser-based, persists across sessions
- **File System API**: For supported browsers, allows folder selection
- **Custom**: Plugin architecture for external providers

```tsx
import { StoragePicker } from '@strixun/chat/react';

<StoragePicker
  currentConfig={{ location: 'indexeddb' }}
  onChange={(config) => saveStoragePreference(config)}
/>
```

## Integrity Badge

Display the integrity status of chat history:

```tsx
import { IntegrityBadge } from '@strixun/chat/react';

<IntegrityBadge
  integrity={{
    score: 95,
    status: 'verified',
    description: 'Complete history verified across 3 peers',
    peerCount: 3,
    totalBlocks: 150,
    gaps: [],
    chunks: [...],
  }}
  showDetails={true}
/>
```

## Gap Detection

When messages are missing, the UI clearly communicates:

```tsx
import { GapWarning } from '@strixun/chat/react';

<GapWarning
  gaps={[
    { start: 10, end: 15, reasons: ['peer_offline'], detectedAt: Date.now() }
  ]}
  onRequestSync={() => manager.requestSync()}
/>
```

Gap reasons include:
- `peer_offline`: Some peers were offline
- `network_partition`: Network connectivity issues
- `late_join`: User joined after messages were sent
- `storage_corruption`: Local storage may be corrupted
- `sync_timeout`: Sync request timed out

## Security Considerations

- **No Central Server**: Messages never pass through a central server in plaintext
- **Room Keys**: Only room participants have the decryption key
- **HMAC Signatures**: Prevent message forgery
- **Hash Chain**: Detects tampering with history order
- **Peer Consensus**: Multiple peers must confirm message authenticity

## Browser Support

- Chrome/Edge 80+
- Firefox 78+
- Safari 14+
- PWA supported

## License

Proprietary - Strixun Stream Suite
