/**
 * Music source services for fetching copyright-free music
 * 
 * Integrates with various free music APIs and sources
 */

import type { MusicTrack, MusicSource, MusicSearchParams } from '../types.js';

/**
 * Free Music Archive API integration
 * Note: FMA doesn't have a public API, so we'll use curated playlists/links
 */
async function fetchFromFreeMusicArchive(params: MusicSearchParams): Promise<MusicTrack[]> {
  // FMA doesn't have a public API, so we return curated lo-fi tracks
  // In production, you might want to scrape or use a proxy
  const tracks: MusicTrack[] = [
    {
      id: 'fma-lofi-1',
      title: 'Lo-Fi Study Beats',
      artist: 'Various Artists',
      url: 'https://freemusicarchive.org/music/audiorezout/vanillaweb/vanillaweb-lo-fi-mix',
      source: 'freemusicarchive',
      genre: 'lo-fi',
      license: 'CC BY',
      attribution: 'Free Music Archive'
    }
  ];
  
  if (params.query) {
    return tracks.filter(t => 
      t.title.toLowerCase().includes(params.query!.toLowerCase()) ||
      t.artist.toLowerCase().includes(params.query!.toLowerCase())
    );
  }
  
  return tracks;
}

/**
 * SoundCloud API integration (using public tracks)
 * Note: SoundCloud requires API keys for full access, but we can use public embeds
 */
async function fetchFromSoundCloud(params: MusicSearchParams): Promise<MusicTrack[]> {
  // SoundCloud requires OAuth for API access
  // For now, return curated public lo-fi tracks
  const tracks: MusicTrack[] = [
    {
      id: 'sc-lofi-1',
      title: 'Lo-Fi Vibes',
      artist: 'Free No Copyright',
      url: 'https://soundcloud.com/musiqueslibre2droit/sets/lo-fi-vibes-free-no-copyright',
      source: 'soundcloud',
      genre: 'lo-fi',
      license: 'Free to use',
      attribution: 'SoundCloud'
    }
  ];
  
  if (params.query) {
    return tracks.filter(t => 
      t.title.toLowerCase().includes(params.query!.toLowerCase()) ||
      t.artist.toLowerCase().includes(params.query!.toLowerCase())
    );
  }
  
  return tracks;
}

/**
 * Jamendo API integration
 * Jamendo has a public API for free music
 */
async function fetchFromJamendo(params: MusicSearchParams): Promise<MusicTrack[]> {
  try {
    // Jamendo API endpoint (requires API key, but has free tier)
    // For now, return placeholder - in production, implement actual API call
    const tracks: MusicTrack[] = [];
    
    // Example API call structure:
    // const response = await fetch(
    //   `https://api.jamendo.com/v3.0/tracks/?client_id=${env.JAMENDO_CLIENT_ID}&format=json&limit=${params.limit || 20}&search=${params.query || 'lofi'}`
    // );
    // const data = await response.json();
    // Process and return tracks
    
    return tracks;
  } catch (error) {
    console.error('Jamendo API error:', error);
    return [];
  }
}

/**
 * Direct URL music source (for user-provided URLs)
 */
async function fetchDirectUrl(url: string): Promise<MusicTrack | null> {
  try {
    // Validate URL and fetch metadata if possible
    return {
      id: `direct-${Date.now()}`,
      title: 'Direct Audio',
      artist: 'Unknown',
      url: url,
      source: 'direct',
      license: 'Unknown'
    };
  } catch (error) {
    console.error('Direct URL error:', error);
    return null;
  }
}

/**
 * Main music fetching service
 */
export async function fetchMusicTracks(params: MusicSearchParams): Promise<MusicTrack[]> {
  const { source, query, limit = 20, offset = 0 } = params;
  
  let tracks: MusicTrack[] = [];
  
  if (source) {
    switch (source) {
      case 'freemusicarchive':
        tracks = await fetchFromFreeMusicArchive(params);
        break;
      case 'soundcloud':
        tracks = await fetchFromSoundCloud(params);
        break;
      case 'jamendo':
        tracks = await fetchFromJamendo(params);
        break;
      default:
        // Fetch from all sources
        const [fmaTracks, scTracks, jamendoTracks] = await Promise.all([
          fetchFromFreeMusicArchive(params),
          fetchFromSoundCloud(params),
          fetchFromJamendo(params)
        ]);
        tracks = [...fmaTracks, ...scTracks, ...jamendoTracks];
    }
  } else {
    // Fetch from all sources
    const [fmaTracks, scTracks, jamendoTracks] = await Promise.all([
      fetchFromFreeMusicArchive(params),
      fetchFromSoundCloud(params),
      fetchFromJamendo(params)
    ]);
    tracks = [...fmaTracks, ...scTracks, ...jamendoTracks];
  }
  
  // Apply filters
  if (query) {
    tracks = tracks.filter(t => 
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase()) ||
      (t.genre && t.genre.toLowerCase().includes(query.toLowerCase()))
    );
  }
  
  // Apply pagination
  const paginatedTracks = tracks.slice(offset, offset + limit);
  
  return paginatedTracks;
}

export { fetchDirectUrl };
