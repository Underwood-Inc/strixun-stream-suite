/**
 * Music API routes
 */

import type { Env } from '../types.js';
import { fetchMusicTracks, fetchDirectUrl } from '../services/music-sources.js';
import { createError } from '../utils/errors.js';
import { getCorsHeaders } from '../utils/cors.js';
import type { MusicSearchParams, MusicSearchResponse } from '../types.js';

export async function handleMusicRoutes(
  request: Request,
  path: string,
  env: Env
): Promise<{ response: Response } | null> {
  const url = new URL(request.url);
  
  // GET /api/music/search - Search for music tracks
  if (path === '/api/music/search' && request.method === 'GET') {
    const params: MusicSearchParams = {
      query: url.searchParams.get('query') || undefined,
      genre: url.searchParams.get('genre') || undefined,
      limit: parseInt(url.searchParams.get('limit') || '20', 10),
      offset: parseInt(url.searchParams.get('offset') || '0', 10),
      source: url.searchParams.get('source') as any || undefined,
    };
    
    try {
      const tracks = await fetchMusicTracks(params);
      
      const response: MusicSearchResponse = {
        tracks,
        total: tracks.length,
        limit: params.limit || 20,
        offset: params.offset || 0,
      };
      
      return {
        response: new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request),
          },
        }),
      };
    } catch (error: any) {
      console.error('Music search error:', error);
      const rfcError = createError(
        request,
        500,
        'Internal Server Error',
        'Failed to search for music tracks'
      );
      return {
        response: new Response(JSON.stringify(rfcError), {
          status: 500,
          headers: {
            'Content-Type': 'application/problem+json',
            ...getCorsHeaders(env, request),
          },
        }),
      };
    }
  }
  
  // GET /api/music/tracks/:id - Get specific track
  if (path.startsWith('/api/music/tracks/') && request.method === 'GET') {
    const trackId = path.split('/').pop();
    if (!trackId) {
      const rfcError = createError(request, 400, 'Bad Request', 'Track ID is required');
      return {
        response: new Response(JSON.stringify(rfcError), {
          status: 400,
          headers: {
            'Content-Type': 'application/problem+json',
            ...getCorsHeaders(env, request),
          },
        }),
      };
    }
    
    // For now, return a placeholder - in production, fetch from cache or source
    const rfcError = createError(request, 501, 'Not Implemented', 'Track details endpoint not yet implemented');
    return {
      response: new Response(JSON.stringify(rfcError), {
        status: 501,
        headers: {
          'Content-Type': 'application/problem+json',
          ...getCorsHeaders(env, request),
        },
      }),
    };
  }
  
  // POST /api/music/direct - Add direct URL track
  if (path === '/api/music/direct' && request.method === 'POST') {
    try {
      const body = await request.json() as { url: string };
      
      if (!body.url) {
        const rfcError = createError(request, 400, 'Bad Request', 'URL is required');
        return {
          response: new Response(JSON.stringify(rfcError), {
            status: 400,
            headers: {
              'Content-Type': 'application/problem+json',
              ...getCorsHeaders(env, request),
            },
          }),
        };
      }
      
      const track = await fetchDirectUrl(body.url);
      
      if (!track) {
        const rfcError = createError(request, 400, 'Bad Request', 'Invalid URL or unable to fetch track');
        return {
          response: new Response(JSON.stringify(rfcError), {
            status: 400,
            headers: {
              'Content-Type': 'application/problem+json',
              ...getCorsHeaders(env, request),
            },
          }),
        };
      }
      
      return {
        response: new Response(JSON.stringify(track), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(env, request),
          },
        }),
      };
    } catch (error: any) {
      console.error('Direct URL error:', error);
      const rfcError = createError(
        request,
        500,
        'Internal Server Error',
        'Failed to process direct URL'
      );
      return {
        response: new Response(JSON.stringify(rfcError), {
          status: 500,
          headers: {
            'Content-Type': 'application/problem+json',
            ...getCorsHeaders(env, request),
          },
        }),
      };
    }
  }
  
  return null;
}
