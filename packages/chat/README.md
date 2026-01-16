# @strixun/chat

Framework-agnostic P2P chat client with WebRTC signaling.

## Features

- ✓ Peer-to-peer WebRTC messaging
- ✓ Room creation and management
- ✓ Typing indicators
- ✓ User presence
- ✓ Message encryption (optional)
- ✓ Framework-agnostic core
- ✓ React/Zustand adapter
- ✓ Drop-in React components

## Installation

```bash
pnpm add @strixun/chat
```

## Usage

### React with Zustand

```tsx
// 1. Create the store (stores/chat.ts)
import { createChatStore } from '@strixun/chat/zustand';

export const useChatStore = createChatStore({
  signalingBaseUrl: 'https://chat-api.idling.app',
});

// 2. Use the ChatClient component
import { ChatClient } from '@strixun/chat/react';
import { useChatStore } from './stores/chat';
import { useAuthStore } from './stores/auth';

function ChatPage() {
  const { customer } = useAuthStore();
  
  if (!customer) {
    return <div>Please log in to use chat</div>;
  }
  
  return (
    <ChatClient
      useChatStore={useChatStore}
      userId={customer.customerId}
      userName={customer.displayName || customer.email}
      showRoomList={true}
      showRoomCreator={true}
    />
  );
}
```

### Vanilla JavaScript

```ts
import { RoomManager } from '@strixun/chat/core';

const roomManager = new RoomManager({
  signalingBaseUrl: 'https://chat-api.idling.app',
  userId: 'user-123',
  userName: 'John Doe',
  onMessage: (message) => {
    console.log('New message:', message);
    // Update your UI
  },
  onConnectionStateChange: (state) => {
    console.log('Connection state:', state.status);
  },
  onError: (error) => {
    console.error('Chat error:', error);
  },
});

// Create a room
const room = await roomManager.createRoom('My Chat Room');

// Or join an existing room
const room = await roomManager.joinRoom('room-id-here');

// Send a message
await roomManager.sendMessage('Hello, world!');

// Leave room
await roomManager.leaveRoom();
```

### With Custom Authentication

```ts
import { createChatStore } from '@strixun/chat/zustand';

const useChatStore = createChatStore({
  signalingBaseUrl: 'https://chat.idling.app',
  // Provide custom authenticated fetch
  authenticatedFetch: async (url, options) => {
    const token = await getMyAuthToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  },
});
```

## API Reference

### Core

#### `RoomManager`

The main class for managing chat rooms and connections.

```ts
new RoomManager({
  signalingBaseUrl: string;
  userId: string;
  userName: string;
  authenticatedFetch?: AuthenticatedFetchFn;
  encrypt?: (content: string) => Promise<EncryptedData>;
  decrypt?: (data: EncryptedData) => Promise<string>;
  onMessage?: (message: ChatMessage) => void;
  onConnectionStateChange?: (state: ChatConnectionState) => void;
  onRoomChange?: (room: RoomMetadata | null) => void;
  onParticipantJoin?: (userId: string) => void;
  onParticipantLeave?: (userId: string) => void;
  onTyping?: (userId: string, userName: string, isTyping: boolean) => void;
  onPresence?: (userId: string, userName: string, status: string) => void;
  onError?: (error: Error) => void;
});
```

Methods:
- `createRoom(customName?: string): Promise<RoomMetadata>`
- `joinRoom(roomId: string): Promise<RoomMetadata>`
- `leaveRoom(): Promise<void>`
- `sendMessage(content: string, emoteIds?: string[], customEmojiIds?: string[]): Promise<void>`
- `sendTypingIndicator(isTyping: boolean): void`
- `sendPresence(status: 'online' | 'offline' | 'away'): void`
- `getActiveRooms(): Promise<RoomMetadata[]>`
- `isConnected(): boolean`
- `destroy(): void`

### Zustand Adapter

#### `createChatStore(config)`

Creates a Zustand store for React applications.

```ts
const useChatStore = createChatStore({
  signalingBaseUrl: string;
  authenticatedFetch?: AuthenticatedFetchFn;
  encrypt?: (content: string) => Promise<EncryptedData>;
  decrypt?: (data: EncryptedData) => Promise<string>;
});
```

### React Components

#### `ChatClient`

Main drop-in chat component.

```tsx
<ChatClient
  useChatStore={useChatStore}
  userId={userId}
  userName={userName}
  showRoomList={true}
  showRoomCreator={true}
/>
```

#### `ChatMessage`

Single message display component.

```tsx
<ChatMessage message={message} currentUserId={userId} />
```

#### `ChatInput`

Message input component.

```tsx
<ChatInput onSend={handleSend} onTyping={handleTyping} disabled={false} />
```

#### `RoomList`

List of available rooms.

```tsx
<RoomList
  fetchRooms={fetchRooms}
  onJoinRoom={handleJoin}
  onCreateRoom={handleCreate}
  showCreateButton={true}
/>
```

#### `RoomCreator`

Room creation form.

```tsx
<RoomCreator
  onCreateRoom={handleCreate}
  onCancel={handleCancel}
  loading={false}
/>
```

## Types

See `@strixun/chat/core/types` for all type definitions.

## License

Private - Strixun Stream Suite
