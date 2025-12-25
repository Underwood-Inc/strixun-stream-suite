/**
 * Twitch API Handlers
 * 
 * Handles all Twitch API proxy endpoints
 */

import { getCorsHeaders } from '../utils/cors.js';

const TWITCH_API_BASE = 'https://api.twitch.tv/helix';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';

/**
 * Get or refresh App Access Token
 * Uses KV storage for caching with TTL
 */
export async function getAppAccessToken(env) {
    // Try to get cached token from KV
    const cachedToken = await env.TWITCH_CACHE.get('app_access_token');
    if (cachedToken) {
        return cachedToken;
    }

    // Fetch new token
    const response = await fetch(TWITCH_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: env.TWITCH_CLIENT_ID,
            client_secret: env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials',
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get app access token: ${response.status}`);
    }

    const data = await response.json();
    const token = data.access_token;
    
    // Cache token in KV (expires_in is typically 5000000 seconds, we'll cache for 4 hours)
    await env.TWITCH_CACHE.put('app_access_token', token, { expirationTtl: 14400 });
    
    return token;
}

/**
 * Make authenticated request to Twitch API
 */
async function twitchApiRequest(endpoint, env, userToken = null) {
    const token = userToken || await getAppAccessToken(env);
    
    const response = await fetch(`${TWITCH_API_BASE}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': env.TWITCH_CLIENT_ID,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitch API error: ${response.status} - ${errorText}`);
    }

    return response.json();
}

/**
 * Get user ID from username
 */
async function getUserId(username, env) {
    const cacheKey = `user_id_${username.toLowerCase()}`;
    const cached = await env.TWITCH_CACHE.get(cacheKey);
    if (cached) return cached;

    const data = await twitchApiRequest(`/users?login=${encodeURIComponent(username)}`, env);
    
    if (data.data && data.data.length > 0) {
        const userId = data.data[0].id;
        // Cache user ID for 24 hours
        await env.TWITCH_CACHE.put(cacheKey, userId, { expirationTtl: 86400 });
        return userId;
    }
    
    return null;
}

/**
 * Shuffle array in place
 */
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Handle /clips endpoint
 */
export async function handleClips(request, env) {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const shuffle = url.searchParams.get('shuffle') === 'true';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const preferFeatured = url.searchParams.get('prefer_featured') === 'true';

    if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel parameter required' }), {
            status: 400,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        const userId = await getUserId(channel, env);
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User not found', data: [] }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Build clips endpoint
        let endpoint = `/clips?broadcaster_id=${userId}&first=${limit}`;
        if (startDate) endpoint += `&started_at=${encodeURIComponent(startDate)}`;
        if (endDate) endpoint += `&ended_at=${encodeURIComponent(endDate)}`;
        if (preferFeatured) endpoint += '&is_featured=true';

        const data = await twitchApiRequest(endpoint, env);
        
        // Transform clips to include direct video URL
        const clips = data.data.map((clip, index) => ({
            ...clip,
            item: index,
            // Twitch clip video URL pattern
            clip_url: clip.thumbnail_url.replace('-preview-480x272.jpg', '.mp4'),
        }));

        // Shuffle if requested
        if (shuffle) {
            shuffleArray(clips);
        }

        return new Response(JSON.stringify({ data: clips, pagination: data.pagination || {} }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /following endpoint
 */
export async function handleFollowing(request, env) {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100);
    const ref = url.searchParams.get('ref'); // Base64 encoded user token
    const after = url.searchParams.get('after');

    if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel parameter required' }), {
            status: 400,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        const userId = await getUserId(channel, env);
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User not found', data: [] }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // User token required for following endpoint
        let userToken = null;
        if (ref) {
            try {
                userToken = atob(ref);
            } catch (e) {
                // Invalid base64, ignore
            }
        }

        let endpoint = `/channels/followed?user_id=${userId}&first=${limit}`;
        if (after) endpoint += `&after=${encodeURIComponent(after)}`;

        const data = await twitchApiRequest(endpoint, env, userToken);

        return new Response(JSON.stringify({ data: data.data, pagination: data.pagination || {} }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [], pagination: {} }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /game endpoint
 */
export async function handleGame(request, env) {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('id');

    if (!gameId) {
        return new Response(JSON.stringify({ error: 'Game ID required' }), {
            status: 400,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        // Try cache first
        const cacheKey = `game_${gameId}`;
        const cached = await env.TWITCH_CACHE.get(cacheKey, { type: 'json' });
        if (cached) {
            return new Response(JSON.stringify(cached), {
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const data = await twitchApiRequest(`/games?id=${gameId}`, env);
        
        // Cache for 7 days (games don't change often)
        await env.TWITCH_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 604800 });

        return new Response(JSON.stringify(data), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /user endpoint
 */
export async function handleUser(request, env) {
    const url = new URL(request.url);
    const login = url.searchParams.get('login');

    if (!login) {
        return new Response(JSON.stringify({ error: 'Login parameter required' }), {
            status: 400,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        const data = await twitchApiRequest(`/users?login=${encodeURIComponent(login)}`, env);
        return new Response(JSON.stringify(data), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

