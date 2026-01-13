/**
 * Music API Client - Fetches tracks from the music API
 */

import type { AudioTrack } from '../types.js';

export interface MusicSearchParams {
  query?: string;
  genre?: string;
  limit?: number;
  offset?: number;
  source?: string;
}

export interface MusicSearchResponse {
  tracks: AudioTrack[];
  total: number;
  limit: number;
  offset: number;
}

export class MusicAPIClient {
  private apiUrl: string;
  
  constructor(apiUrl: string = 'http://localhost:8790') {
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }
  
  /**
   * Search for music tracks
   */
  async search(params: MusicSearchParams): Promise<MusicSearchResponse> {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.set('query', params.query);
    if (params.genre) queryParams.set('genre', params.genre);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.source) queryParams.set('source', params.source);
    
    const url = `${this.apiUrl}/api/music/search?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as MusicSearchResponse;
      return data;
    } catch (error) {
      console.error('Music API search error:', error);
      throw error;
    }
  }
  
  /**
   * Add a direct URL track
   */
  async addDirectUrl(url: string): Promise<AudioTrack> {
    const apiUrl = `${this.apiUrl}/api/music/direct`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const track = await response.json() as AudioTrack;
      return track;
    } catch (error) {
      console.error('Music API direct URL error:', error);
      throw error;
    }
  }
}
