# Chat Signaling Server

Minimal Cloudflare Worker for WebRTC signaling in the P2P chat system.

## Setup

1. **Create KV Namespace:**
   ```bash
   wrangler kv namespace create "CHAT_KV"
   ```
   Copy the returned ID and update `wrangler.toml`.

2. **Set JWT Secret:**
   ```bash
   wrangler secret put JWT_SECRET
   ```
   Use the same secret as your main API worker.

3. **Deploy:**
   ```bash
   wrangler deploy
   ```

## Endpoints

- `POST /signaling/create-room` - Create a new chat room
- `POST /signaling/join-room` - Join an existing room
- `POST /signaling/offer` - Send WebRTC offer
- `GET /signaling/offer/:roomId` - Get WebRTC offer
- `POST /signaling/answer` - Send WebRTC answer
- `GET /signaling/answer/:roomId` - Get WebRTC answer
- `POST /signaling/heartbeat` - Keep room alive
- `GET /signaling/rooms` - List active public rooms
- `POST /signaling/leave` - Leave a room
- `GET /health` - Health check

## Features

- [SUCCESS] JWT authentication
- [SUCCESS] Room lifecycle management
- [SUCCESS] WebRTC offer/answer exchange
- [SUCCESS] Room discovery
- [SUCCESS] Automatic cleanup (TTL-based)
- [SUCCESS] Heartbeat system

## Storage

- **Room Metadata**: `chat_room_{roomId}` (1 hour TTL)
- **Offers**: `chat_offer_{roomId}` (30 second TTL, single-use)
- **Answers**: `chat_answer_{roomId}` (30 second TTL, single-use)
- **Active Rooms List**: `chat_active_rooms` (1 hour TTL)

## Cost

- **Free Tier**: 100,000 requests/day
- **KV**: 100,000 reads/day (free tier)
- **Estimated**: $0-5/month depending on usage

