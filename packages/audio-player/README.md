# Audio Player Package

Audio-responsive music player with Howler.js and Web Audio API integration.

## Features

- Audio playback with Howler.js
- Real-time audio analysis with Web Audio API
- Automatic floating player positioning
- React and Svelte components
- Music search integration
- Audio visualization
- Responsive design

## Installation

```bash
pnpm install @strixun/audio-player
```

## Usage

### React

```tsx
import { AudioPlayer } from '@strixun/audio-player/react';
import { useMusicSearch } from '@strixun/audio-player/hooks';

function MyComponent() {
  const { tracks, search, isLoading } = useMusicSearch({ apiUrl: 'http://localhost:8791' });
  
  useEffect(() => {
    search({ genre: 'lo-fi', limit: 10 });
  }, []);
  
  return (
    <AudioPlayer
      track={tracks[0]}
      floating={true}
      position="bottom-right"
      onAnalysis={(analysis) => {
        console.log('Bass:', analysis.bass);
        console.log('Volume:', analysis.volume);
      }}
    />
  );
}
```

### Svelte

```svelte
<script>
  import AudioPlayer from '@strixun/audio-player/svelte/AudioPlayer.svelte';
  
  let track = {
    id: '1',
    title: 'Lo-Fi Study Beats',
    artist: 'Various Artists',
    url: 'https://example.com/audio.mp3',
  };
</script>

<AudioPlayer
  {track}
  floating={true}
  position="bottom-right"
  onAnalysis={(analysis) => {
    console.log('Analysis:', analysis);
  }}
/>
```

### Core API

```typescript
import { AudioEngine } from '@strixun/audio-player';

const engine = new AudioEngine({
  track: myTrack,
  onAnalysis: (analysis) => {
    // Use analysis data for responsive elements
    console.log('Bass:', analysis.bass);
    console.log('Mid:', analysis.mid);
    console.log('Treble:', analysis.treble);
    console.log('Volume:', analysis.volume);
  },
});

await engine.loadTrack(myTrack);
engine.play();
```

## Floating Player

The player automatically detects if it's inside a positioned container. If not, it renders as a floating player in the specified corner.

- `floating={true}` - Force floating mode
- `floating={false}` - Force inline mode
- `floating={undefined}` - Auto-detect (default)

## Audio Analysis

The player provides real-time audio analysis data using Web Audio API:

- `frequencyData` - Frequency spectrum (Uint8Array)
- `timeDomainData` - Waveform data (Uint8Array)
- `bass` - Bass frequency band (0-255)
- `mid` - Mid frequency band (0-255)
- `treble` - Treble frequency band (0-255)
- `volume` - Overall volume (0-1)

## Music API Integration

The package includes a client for the Music API:

```typescript
import { MusicAPIClient } from '@strixun/audio-player';

const client = new MusicAPIClient('http://localhost:8791');
const results = await client.search({ genre: 'lo-fi', limit: 20 });
```

## Hooks

### useAudioAnalysis

React hook for accessing audio analysis data:

```tsx
import { useAudioAnalysis } from '@strixun/audio-player/hooks';

const { bass, mid, treble, volume, beat } = useAudioAnalysis(analysis);
```

### useMusicSearch

React hook for searching music:

```tsx
import { useMusicSearch } from '@strixun/audio-player/hooks';

const { tracks, search, isLoading } = useMusicSearch({ apiUrl: 'http://localhost:8791' });
```

## Styling

The player uses CSS variables for theming:

- `--card` - Background color
- `--text` - Text color
- `--primary` - Primary accent color
- `--primary-hover` - Primary hover color
- `--error` - Error color

## Advanced Analysis

For more advanced audio analysis features (beat detection, tempo estimation, etc.), you can integrate essentia.js separately. The Web Audio API provides sufficient analysis for most responsive visualizations.

## License

Private package for Strixun Stream Suite.
