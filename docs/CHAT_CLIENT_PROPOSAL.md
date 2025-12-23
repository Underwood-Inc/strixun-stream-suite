# 🎯 Custom P2P Chat Client - Architecture Proposal

**Ahoy there, ye brave developer!** 🧙‍♂️⚓ This here be the comprehensive proposal for buildin' a custom peer-to-peer chat client that be decoupled, agnostic, and scalable as the seven seas!

## 📋 Overview

We're buildin' a **standalone chat service** that can be embedded in yer dashboard or any configured domain. It'll support:
- ✅ **7TV emotes** natively
- ✅ **Custom emojis** exclusive to yer domain
- ✅ **End-to-end encryption** (leveragin' existing system)
- ✅ **Peer-to-peer architecture** (minimal server dependency)
- ✅ **Room/channel management** for streamers
- ✅ **Platform-agnostic** (works anywhere)

---

## 🏗️ Architecture Design

### Core Principles

1. **Decoupled**: Chat service is a separate entity from the dashboard
2. **Agnostic**: Can be embedded in any domain/application
3. **Scalable**: P2P reduces server load, scales with users
4. **Lightweight**: Minimal dependencies, optimized bundle size
5. **Secure**: E2E encryption for all messages

### Technology Stack

- **Frontend**: Svelte 5 + TypeScript (matches existing stack)
- **P2P Communication**: WebRTC DataChannels
- **Signaling**: Minimal Cloudflare Worker (separate from main API)
- **Encryption**: Leverage existing `encryption.ts` service
- **Emotes**: 7TV API v3 + Custom emoji system
- **Storage**: Cloudflare KV (minimal metadata only)

---

## 🔧 Technical Architecture

### 1. Peer-to-Peer Communication (WebRTC)

**Why WebRTC?**
- Built-in E2E encryption (DTLS)
- Direct peer-to-peer connections (no message relay)
- Low latency
- Browser-native (no extra dependencies)

**How It Works:**
```
User A (Signaler)          Signaling Server          User B (Joiner)
     |                            |                        |
     |--- Create Room ----------->|                        |
     |<-- Room ID ----------------|                        |
     |                            |                        |
     |                            |<--- Join Room ---------|
     |                            |--- Room Info --------->|
     |                            |                        |
     |<--- Offer Request ---------|                        |
     |--- Offer ----------------->|                        |
     |                            |--- Offer ------------->|
     |                            |<--- Answer ------------|
     |<--- Answer ----------------|                        |
     |                            |                        |
     |========== P2P Connection ===========>|
     |                            |                        |
     |<========== Direct Messages ===========|
```

**Key Points:**
- Signaling server ONLY handles initial connection setup
- Once connected, all messages go P2P (no server involved)
- If signaling server goes down, existing connections stay alive
- New connections require signaling server

### 2. Room Management

**Room Lifecycle:**
1. **Room Creation**: Broadcaster creates room → Gets room ID
2. **Room Discovery**: Active rooms stored in KV (minimal metadata)
3. **Room Joining**: Users join via room ID or broadcaster username
4. **Room Cleanup**: Room removed from KV when last user leaves

**Room Data Structure (KV):**
```typescript
interface RoomMetadata {
  roomId: string;           // Unique room identifier
  broadcasterId: string;    // User ID of broadcaster
  broadcasterName: string;  // Display name
  createdAt: string;        // ISO timestamp
  participantCount: number;  // Current participants
  isPublic: boolean;        // Can be discovered
  customName?: string;       // Optional custom room name
}
```

**Storage Strategy:**
- **KV Key**: `chat_room_{roomId}`
- **TTL**: 1 hour (auto-expires if no activity)
- **Heartbeat**: Clients ping every 30 seconds to keep room alive

### 3. Signaling Server (Minimal Cloudflare Worker)

**Purpose**: Only for initial WebRTC connection setup

**Endpoints:**
```
POST /signaling/create-room
  - Creates room metadata
  - Returns room ID and signaling token

POST /signaling/join-room
  - Validates room exists
  - Returns room info and signaling token

POST /signaling/offer
  - Receives WebRTC offer from peer A
  - Stores offer temporarily (30s TTL)

GET /signaling/offer/{roomId}
  - Peer B polls for offer
  - Returns offer when available

POST /signaling/answer
  - Receives WebRTC answer from peer B
  - Stores answer temporarily (30s TTL)

GET /signaling/answer/{roomId}
  - Peer A polls for answer
  - Returns answer when available

POST /signaling/heartbeat
  - Updates room activity timestamp
  - Keeps room alive in KV

GET /signaling/rooms
  - Lists active public rooms
  - Returns minimal metadata only
```

**Data Flow:**
1. Room creator generates WebRTC offer
2. Offer sent to signaling server
3. Joiner polls signaling server for offer
4. Joiner generates answer
5. Answer sent to signaling server
6. Creator polls for answer
7. P2P connection established
8. Signaling server no longer needed

### 4. End-to-End Encryption

**Leverage Existing System:**
- Use `encryption.ts` service for message encryption
- JWT token from OAuth used for key derivation
- Each message encrypted before sending via WebRTC
- Recipient decrypts using their token

**Message Structure:**
```typescript
interface EncryptedMessage {
  id: string;                    // Unique message ID
  roomId: string;                 // Room identifier
  senderId: string;               // Sender user ID
  senderName: string;             // Display name
  timestamp: string;              // ISO timestamp
  encrypted: EncryptedData;       // Encrypted message content
  emoteIds?: string[];            // 7TV emote IDs in message
  customEmojiIds?: string[];      // Custom emoji IDs
}
```

### 5. 7TV Emote Integration

**API Endpoints:**
- `GET https://7tv.io/v3/emotes/{emoteId}` - Get emote data
- `GET https://7tv.io/v3/users/{userId}/emotes` - Get user's emotes
- `GET https://7tv.io/v3/emotes/global` - Get global emotes

**Implementation:**
- Fetch emote metadata on message send
- Store emote IDs in message
- Render emotes client-side using 7TV CDN URLs
- Cache emote data locally (IndexedDB)

**Emote Format:**
```typescript
interface EmoteData {
  id: string;
  name: string;
  url: string;           // CDN URL for emote image
  animated: boolean;
  width: number;
  height: number;
}
```

### 6. Custom Emoji System

**Storage:**
- Custom emojis stored in Cloudflare KV
- Key format: `custom_emoji_{domain}_{emojiId}`
- Accessible only from configured domains

**API Endpoints:**
```
GET /emoji/list?domain={domain}
  - Returns all custom emojis for domain

POST /emoji/upload
  - Upload new custom emoji (requires auth)
  - Validates domain ownership

GET /emoji/{emojiId}
  - Returns emoji image (CDN)
```

**Emoji Format:**
```typescript
interface CustomEmoji {
  id: string;
  name: string;
  url: string;           // CDN URL
  domain: string;        // Exclusive domain
  uploadedBy: string;    // User ID
  uploadedAt: string;    // ISO timestamp
}
```

---

## 📁 Project Structure

```
chat-service/
├── src/
│   ├── components/
│   │   ├── ChatClient.svelte          # Main chat component
│   │   ├── ChatMessage.svelte         # Individual message
│   │   ├── ChatInput.svelte           # Message input with emote picker
│   │   ├── EmotePicker.svelte        # 7TV + custom emote picker
│   │   ├── RoomList.svelte           # Available rooms
│   │   └── RoomCreator.svelte        # Create/join room UI
│   ├── services/
│   │   ├── webrtc.ts                 # WebRTC connection management
│   │   ├── signaling.ts              # Signaling server client
│   │   ├── encryption.ts             # Message encryption (wrapper)
│   │   ├── emotes.ts                 # 7TV emote service
│   │   ├── customEmojis.ts           # Custom emoji service
│   │   └── roomManager.ts             # Room lifecycle management
│   ├── stores/
│   │   ├── chat.ts                   # Chat state (messages, room)
│   │   ├── connection.ts             # WebRTC connection state
│   │   └── emotes.ts                 # Emote cache/store
│   ├── types/
│   │   └── chat.ts                   # TypeScript interfaces
│   └── utils/
│       ├── messageParser.ts          # Parse messages for emotes
│       └── roomUtils.ts              # Room utilities
├── serverless/
│   └── chat-signaling/
│       ├── worker.js                 # Signaling server worker
│       ├── wrangler.toml
│       └── package.json
└── package.json
```

---

## 🔐 Security Considerations

### Authentication
- Use existing Cloudflare OAuth (JWT tokens)
- Validate tokens on signaling server
- Tokens required for room creation

### Encryption
- WebRTC DTLS (built-in)
- Application-layer encryption (existing `encryption.ts`)
- Double encryption for sensitive messages

### Rate Limiting
- Limit room creation (per user)
- Limit message sending (prevent spam)
- Limit signaling requests

### Privacy
- No message storage on server
- Room metadata minimal (no message content)
- P2P means no message relay through server

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure
- [ ] WebRTC connection management
- [ ] Signaling server (minimal worker)
- [ ] Basic message sending/receiving
- [ ] Room creation/joining

### Phase 2: Encryption & Security
- [ ] Integrate existing encryption service
- [ ] Message encryption/decryption
- [ ] Token validation on signaling server
- [ ] Rate limiting

### Phase 3: Emote System
- [ ] 7TV API integration
- [ ] Emote picker UI
- [ ] Message parsing for emotes
- [ ] Custom emoji system

### Phase 4: Room Management
- [ ] Room discovery
- [ ] Room list UI
- [ ] Room metadata management
- [ ] Heartbeat system

### Phase 5: Polish & Optimization
- [ ] Message history (local storage)
- [ ] Typing indicators
- [ ] User presence
- [ ] Performance optimization
- [ ] Error handling & reconnection

---

## 💰 Cost Analysis

### Cloudflare Worker (Signaling)
- **Free Tier**: 100,000 requests/day
- **Paid**: $5/month for 10M requests
- **KV Storage**: Free tier (100,000 reads/day)
- **Estimated Cost**: $0-5/month (depending on usage)

### Bandwidth
- **P2P**: No server bandwidth (direct peer connections)
- **Signaling**: Minimal (only connection setup)
- **Emote CDN**: 7TV provides CDN (free)

### Storage
- **Room Metadata**: ~1KB per room
- **Custom Emojis**: ~50KB per emoji
- **Total**: Negligible (well within free tier)

---

## 🎯 Success Criteria

1. ✅ **Decoupled**: Chat service works independently
2. ✅ **Agnostic**: Can be embedded in any domain
3. ✅ **Scalable**: Handles 100+ concurrent rooms
4. ✅ **Performant**: <100ms message latency
5. ✅ **Secure**: E2E encryption verified
6. ✅ **Feature-Complete**: 7TV emotes + custom emojis working

---

## 🔮 Future Enhancements

- Voice/video chat (WebRTC media streams)
- File sharing (P2P file transfer)
- Message reactions
- User roles (moderator, subscriber, etc.)
- Message search (local only)
- Push notifications (via service worker)

---

**Next Steps:**
1. Review and approve this proposal
2. Set up separate Cloudflare Worker for signaling
3. Implement core WebRTC infrastructure
4. Integrate with existing OAuth system
5. Build UI components in Svelte

**Let's build this thing!** ⚓🧙‍♂️

