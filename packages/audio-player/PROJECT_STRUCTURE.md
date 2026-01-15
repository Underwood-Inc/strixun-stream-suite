# Audio Player Project Structure

## Overview

This project provides a complete audio-responsive music player system with:
- Backend API for fetching copyright-free music
- Frontend components (React & Svelte)
- Audio analysis engine using Howler.js + Web Audio API
- Automatic floating player positioning

## Project Structure

```
serverless/music-api/          # Cloudflare Worker API
├── handlers/                  # Request handlers
├── router/                    # Route definitions
├── services/                  # Music source integrations
├── utils/                     # Utilities (CORS, errors)
├── types.ts                   # TypeScript types
├── worker.ts                  # Main worker entry
└── wrangler.toml             # Cloudflare config

packages/audio-player/         # Frontend package
├── core/                      # Core engine
│   ├── audio-engine.ts        # Howler.js + Web Audio API
│   ├── music-api-client.ts    # API client
│   └── position-detector.ts   # Floating player logic
├── svelte/                    # Svelte components
│   └── AudioPlayer.svelte
├── react/                     # React components
│   ├── AudioPlayer.tsx
│   └── index.tsx
├── hooks/                     # React hooks
│   ├── useAudioAnalysis.ts
│   ├── useMusicSearch.ts
│   └── index.ts
├── types.ts                   # Shared types
└── core.ts                    # Main exports
```

## Key Features

### 1. Music API (Backend)

- **Location**: `serverless/music-api/`
- **Port**: 8791 (development)
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /api/music/search` - Search tracks
  - `POST /api/music/direct` - Add direct URL

### 2. Audio Engine

- **Location**: `packages/audio-player/core/audio-engine.ts`
- Uses Howler.js for playback
- Web Audio API for real-time analysis
- Provides frequency bands (bass, mid, treble)
- Volume and waveform data

### 3. Floating Player

- **Location**: `packages/audio-player/core/position-detector.ts`
- Auto-detects if element is positioned
- Renders as floating player if not positioned
- Supports 4 corner positions

### 4. Components

- **Svelte**: `packages/audio-player/svelte/AudioPlayer.svelte`
- **React**: `packages/audio-player/react/AudioPlayer.tsx`
- Both support same props and features

## Usage Example

```typescript
// 1. Start the music API worker
cd serverless/music-api
pnpm dev  // Runs on port 8790

// 2. Use in your app
import { AudioPlayer } from '@strixun/audio-player/react';
import { useMusicSearch } from '@strixun/audio-player/hooks';

function App() {
  const { tracks, search } = useMusicSearch({ 
    apiUrl: 'http://localhost:8791' 
  });
  
  useEffect(() => {
    search({ genre: 'lo-fi' });
  }, []);
  
  return (
    <AudioPlayer
      track={tracks[0]}
      floating={true}
      onAnalysis={(analysis) => {
        // Use analysis for responsive elements
        console.log('Bass:', analysis.bass);
      }}
    />
  );
}
```

## Audio Analysis Data

The `onAnalysis` callback provides:

```typescript
{
  frequencyData: Uint8Array,    // 128 frequency bins
  timeDomainData: Uint8Array,    // Waveform data
  bass: number,                 // 0-255 (low frequencies)
  mid: number,                  // 0-255 (mid frequencies)
  treble: number,               // 0-255 (high frequencies)
  volume: number                // 0-1 (overall volume)
}
```

## Music Sources

The API integrates with:
- Free Music Archive (curated tracks)
- SoundCloud (public playlists)
- Jamendo (API integration ready)
- Direct URLs (user-provided)

## Development

```bash
# Install dependencies
pnpm install

# Run music API
cd serverless/music-api
pnpm dev

# Build audio player package
cd packages/audio-player
pnpm build

# Run tests
pnpm test
```

## Notes

- essentia.js was removed from dependencies (not available on npm)
- Web Audio API provides sufficient analysis for most use cases
- Can add essentia.js later if advanced features needed
- All components use CSS variables for theming
