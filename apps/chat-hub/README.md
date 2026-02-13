# Chat Hub

Standalone P2P community chat interface for the Strixun Stream Suite.

## Overview

Chat Hub is a dedicated web application for the P2P chat system, accessible at `https://chat.idling.app`. It provides real-time messaging capabilities using WebRTC for peer-to-peer communication.

## Features

- **P2P Real-time Messaging**: Direct peer-to-peer communication via WebRTC
- **Room Management**: Create, join, and browse available chat rooms
- **Typing Indicators**: See when others are typing
- **HttpOnly Cookie Authentication**: Secure authentication shared with other Strixun services

## URLs

| Environment | Frontend | API |
|-------------|----------|-----|
| Production | https://chat.idling.app | https://chat-api.idling.app |
| Development | http://localhost:5179 | http://localhost:8792 |

## Development

### Prerequisites

- Node.js 20+
- pnpm 9.15+

### Running Locally

```bash
# From repository root
pnpm install

# Run frontend only (requires running API separately)
cd chat-hub
pnpm dev

# Run with API
pnpm dev:all
```

### Environment Variables

| Variable | Description | Default (Dev) | Default (Prod) |
|----------|-------------|---------------|----------------|
| `VITE_AUTH_API_URL` | Auth API endpoint | `/auth-api` (proxy) | `https://auth.idling.app` |
| `VITE_CHAT_SIGNALING_URL` | Chat API endpoint | `/chat-api` (proxy) | `https://chat-api.idling.app` |

## Architecture

```
chat-hub/
  src/
    App.tsx           # Main application component
    main.tsx          # Entry point
    stores/
      auth.ts         # Authentication state (uses @strixun/auth-store)
      chat.ts         # Chat state (uses @strixun/chat)
    styles/
      GlobalStyles.tsx # Global CSS styles
```

## Dependencies

- `@strixun/auth-store` - Authentication state management
- `@strixun/chat` - P2P chat client library
- `@strixun/otp-login` - OTP login component
- React 18+
- Zustand for state management

## Deployment

Deployed automatically via GitHub Actions to Cloudflare Pages.

### Manual Deployment

```bash
# Build
pnpm build

# Deploy to Cloudflare Pages
cd chat-hub
pnpm exec wrangler pages deploy ../dist/chat-hub --project-name=chat-hub
```

## Related

- **@strixun/chat** - Core chat library (`packages/chat`)
- **Chat Signaling API** - WebRTC signaling server (`serverless/chat-signaling`)
- **Mods Hub** - Also includes chat integration (`mods-hub`)
