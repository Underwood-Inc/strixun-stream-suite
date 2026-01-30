/**
 * Type definitions for Music API
 */

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  source: MusicSource;
  duration?: number;
  thumbnail?: string;
  genre?: string;
  license?: string;
  attribution?: string;
}

export type MusicSource = 'freemusicarchive' | 'soundcloud' | 'jamendo' | 'freesound' | 'direct';

export interface MusicSearchParams {
  query?: string;
  genre?: string;
  limit?: number;
  offset?: number;
  source?: MusicSource;
}

export interface MusicSearchResponse {
  tracks: MusicTrack[];
  total: number;
  limit: number;
  offset: number;
}

export interface Env {
  MUSIC_KV?: KVNamespace;  // Optional: For future use with music caching/storage
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
  ROUTES?: string;
  [key: string]: any;
}
