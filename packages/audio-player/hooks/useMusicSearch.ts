/**
 * React hook for searching music tracks
 */

import { useState, useCallback } from 'react';
import { MusicAPIClient, type MusicSearchParams, type MusicSearchResponse } from '../core/music-api-client.js';
import type { AudioTrack } from '../types.js';

export interface UseMusicSearchOptions {
  apiUrl?: string;
  defaultGenre?: string;
}

export function useMusicSearch(options: UseMusicSearchOptions = {}) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  
  const client = new MusicAPIClient(options.apiUrl);
  
  const search = useCallback(async (params: MusicSearchParams) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await client.search({
        ...params,
        genre: params.genre || options.defaultGenre,
      });
      
      setTracks(response.tracks);
      setTotal(response.total);
      return response;
    } catch (err) {
      const error = err as Error;
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [client, options.defaultGenre]);
  
  return {
    tracks,
    isLoading,
    error,
    total,
    search,
  };
}
