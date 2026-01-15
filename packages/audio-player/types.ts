/**
 * Type definitions for Audio Player
 */

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  source?: string;
  duration?: number;
  thumbnail?: string;
  genre?: string;
  license?: string;
  attribution?: string;
}

export interface AudioAnalysis {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  beat?: boolean;
  tempo?: number;
}

export interface AudioPlayerConfig {
  track?: AudioTrack;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
  floating?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  apiUrl?: string;
  onAnalysis?: (analysis: AudioAnalysis) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  track: AudioTrack | null;
  analysis: AudioAnalysis | null;
  error: Error | null;
}
