/**
 * Strixun Stream Suite - Serverless API Worker
 * Cloudflare Worker for Twitch API proxy + Cloud Storage
 * 
 * This worker handles:
 * - App Access Token management (cached)
 * - Clips fetching
 * - User following fetching
 * - Game data fetching
 * - Cloud Save System (backup/restore configs across devices)
 * 
 * @version 2.0.0
 */

// CORS headers for cross-origin requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID',
    'Access-Control-Max-Age': '86400',
};

// Twitch API base URL
const TWITCH_API_BASE = 'https://api.twitch.tv/helix';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';

/**
 * Get or refresh App Access Token
 * Uses KV storage for caching with TTL
 */
async function getAppAccessToken(env) {
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
 * GET /clips?channel=username&limit=20&shuffle=true&start_date=...&end_date=...&prefer_featured=true
 */
async function handleClips(request, env) {
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const userId = await getUserId(channel, env);
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User not found', data: [] }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /following endpoint
 * GET /following?channel=username&limit=100&ref=base64token&after=cursor
 */
async function handleFollowing(request, env) {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 100);
    const ref = url.searchParams.get('ref'); // Base64 encoded user token
    const after = url.searchParams.get('after');

    if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const userId = await getUserId(channel, env);
        if (!userId) {
            return new Response(JSON.stringify({ error: 'User not found', data: [] }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [], pagination: {} }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /game endpoint
 * GET /game?id=gameId
 */
async function handleGame(request, env) {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('id');

    if (!gameId) {
        return new Response(JSON.stringify({ error: 'Game ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        // Try cache first
        const cacheKey = `game_${gameId}`;
        const cached = await env.TWITCH_CACHE.get(cacheKey, { type: 'json' });
        if (cached) {
            return new Response(JSON.stringify(cached), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const data = await twitchApiRequest(`/games?id=${gameId}`, env);
        
        // Cache for 7 days (games don't change often)
        await env.TWITCH_CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 604800 });

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle /user endpoint
 * GET /user?login=username
 */
async function handleUser(request, env) {
    const url = new URL(request.url);
    const login = url.searchParams.get('login');

    if (!login) {
        return new Response(JSON.stringify({ error: 'Login parameter required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const data = await twitchApiRequest(`/users?login=${encodeURIComponent(login)}`, env);
        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message, data: [] }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Health check endpoint
 */
async function handleHealth(env) {
    try {
        // Test token generation
        await getAppAccessToken(env);
        return new Response(JSON.stringify({ 
            status: 'ok', 
            message: 'Strixun Stream Suite API is running',
            features: ['twitch-api', 'cloud-storage', 'scrollbar-customizer'],
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Scrollbar Customizer Module Code
 * Embedded for CDN serving via Cloudflare Worker
 * Source: serverless/scrollbar-customizer.js
 */
const SCROLLBAR_CUSTOMIZER_CODE = `(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 6,
    trackColor: 'transparent',
    thumbColor: '#3d3627',
    thumbHoverColor: '#888',
    borderRadius: 3,
    contentAdjustment: true,
    namespace: 'strixun-scrollbar'
  };

  class ScrollbarCustomizer {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.styleId = \`\${this.config.namespace}-styles\`;
      this.isInitialized = false;
      this.scrollbarWidth = 0;
      this.observer = null;
      this.contentAdjustmentEnabled = this.config.contentAdjustment;
      
      this.init = this.init.bind(this);
      this.destroy = this.destroy.bind(this);
      this.toggleContentAdjustment = this.toggleContentAdjustment.bind(this);
      this.updateScrollbarWidth = this.updateScrollbarWidth.bind(this);
      this.applyContentAdjustment = this.applyContentAdjustment.bind(this);
      this.removeContentAdjustment = this.removeContentAdjustment.bind(this);
    }

    getScrollbarWidth() {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.msOverflowStyle = 'scrollbar';
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      outer.parentNode.removeChild(outer);
      return scrollbarWidth;
    }

    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight || 
             element.scrollWidth > element.clientWidth;
    }

    generateScrollbarCSS() {
      const { width, trackColor, thumbColor, thumbHoverColor, borderRadius } = this.config;
      
      return \`
        ::-webkit-scrollbar {
          width: \${width}px;
          height: \${width}px;
        }

        ::-webkit-scrollbar-track {
          background: \${trackColor};
        }

        ::-webkit-scrollbar-thumb {
          background: \${thumbColor};
          border-radius: \${borderRadius}px;
          transition: background 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: \${thumbHoverColor};
        }

        ::-webkit-scrollbar-corner {
          background: \${trackColor};
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: \${thumbColor} \${trackColor};
        }

        .\${this.config.namespace}-adjusted {
          transition: margin-right 0.2s ease, padding-right 0.2s ease;
        }
      \`;
    }

    injectCSS() {
      const existing = document.getElementById(this.styleId);
      if (existing) {
        existing.remove();
      }

      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = this.generateScrollbarCSS();
      document.head.appendChild(style);
    }

    updateScrollbarWidth() {
      this.scrollbarWidth = this.getScrollbarWidth();
    }

    applyContentAdjustment() {
      if (!this.contentAdjustmentEnabled) return;

      const body = document.body;
      const html = document.documentElement;

      const hasScroll = this.hasScrollbar(body) || this.hasScrollbar(html);
      
      if (hasScroll) {
        const scrollbarWidth = this.getScrollbarWidth();
        
        if (scrollbarWidth > 0) {
          body.style.marginRight = \`-\${scrollbarWidth}px\`;
          body.style.paddingRight = \`\${scrollbarWidth}px\`;
          body.classList.add(\`\${this.config.namespace}-adjusted\`);
        }
      } else {
        this.removeContentAdjustment();
      }
    }

    removeContentAdjustment() {
      const body = document.body;
      body.style.marginRight = '';
      body.style.paddingRight = '';
      body.classList.remove(\`\${this.config.namespace}-adjusted\`);
    }

    setupObserver() {
      if (!this.contentAdjustmentEnabled) return;

      this.observer = new ResizeObserver(() => {
        this.applyContentAdjustment();
      });

      this.observer.observe(document.body);
      this.observer.observe(document.documentElement);

      window.addEventListener('resize', this.applyContentAdjustment);
    }

    cleanupObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      window.removeEventListener('resize', this.applyContentAdjustment);
    }

    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCustomizer already initialized');
        return;
      }

      this.injectCSS();
      this.updateScrollbarWidth();

      if (this.contentAdjustmentEnabled) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            this.applyContentAdjustment();
            this.setupObserver();
          });
        } else {
          this.applyContentAdjustment();
          this.setupObserver();
        }
      }

      this.isInitialized = true;
    }

    toggleContentAdjustment(enabled = null) {
      const newState = enabled !== null ? enabled : !this.contentAdjustmentEnabled;
      
      if (newState === this.contentAdjustmentEnabled) {
        return this.contentAdjustmentEnabled;
      }

      this.contentAdjustmentEnabled = newState;

      if (this.contentAdjustmentEnabled) {
        this.applyContentAdjustment();
        this.setupObserver();
      } else {
        this.removeContentAdjustment();
        this.cleanupObserver();
      }

      return this.contentAdjustmentEnabled;
    }

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      
      if (this.isInitialized) {
        this.injectCSS();
        if (this.contentAdjustmentEnabled) {
          this.applyContentAdjustment();
        }
      }
    }

    destroy() {
      if (!this.isInitialized) return;

      const style = document.getElementById(this.styleId);
      if (style) {
        style.remove();
      }

      this.removeContentAdjustment();
      this.cleanupObserver();

      this.isInitialized = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (!window.ScrollbarCustomizerInstance) {
        window.ScrollbarCustomizerInstance = new ScrollbarCustomizer();
        window.ScrollbarCustomizerInstance.init();
      }
    });
  } else {
    if (!window.ScrollbarCustomizerInstance) {
      window.ScrollbarCustomizerInstance = new ScrollbarCustomizer();
      window.ScrollbarCustomizerInstance.init();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCustomizer;
  } else {
    global.ScrollbarCustomizer = ScrollbarCustomizer;
  }

})(typeof window !== 'undefined' ? window : this);`;

/**
 * Handle scrollbar customizer CDN endpoint
 * GET /cdn/scrollbar-customizer.js
 * Serves the standalone scrollbar customization module
 */
async function handleScrollbarCustomizer() {
    try {
        return new Response(SCROLLBAR_CUSTOMIZER_CODE, {
            headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000, immutable'
            },
        });
    } catch (error) {
        return new Response(`// Error loading scrollbar customizer: ${error.message}`, {
            status: 500,
            headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/javascript'
            },
        });
    }
}

// ============ Cloud Storage System ============

/**
 * Generate a storage key for KV
 * @param {string} deviceId - Unique device identifier
 * @param {string} slot - Save slot name (default, backup1, backup2, etc.)
 * @returns {string}
 */
function getCloudSaveKey(deviceId, slot = 'default') {
    return `cloudsave_${deviceId}_${slot}`;
}

/**
 * Validate device ID (security check)
 * @param {string} deviceId
 * @returns {boolean}
 */
function isValidDeviceId(deviceId) {
    // Must be alphanumeric + dashes/underscores, 8-64 chars
    return /^[a-zA-Z0-9_-]{8,64}$/.test(deviceId);
}

/**
 * Handle cloud save upload
 * POST /cloud/save?slot=default
 * Headers: X-Device-ID
 * Body: { configs, metadata }
 */
async function handleCloudSave(request, env) {
    try {
        const deviceId = request.headers.get('X-Device-ID');
        if (!deviceId || !isValidDeviceId(deviceId)) {
            return new Response(JSON.stringify({ 
                error: 'Valid X-Device-ID header required (8-64 alphanumeric chars)' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';
        
        // Validate slot name
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slot)) {
            return new Response(JSON.stringify({ error: 'Invalid slot name' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse body
        const body = await request.json();
        
        // Create save data with metadata
        const saveData = {
            version: 2,
            deviceId,
            slot,
            timestamp: new Date().toISOString(),
            userAgent: request.headers.get('User-Agent') || 'unknown',
            configs: body.configs || {},
            metadata: body.metadata || {},
        };

        // Validate payload size (KV limit is 25MB, we'll limit to 10MB for safety)
        const saveDataStr = JSON.stringify(saveData);
        if (saveDataStr.length > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'Save data too large (max 10MB)' }), {
                status: 413,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Save to KV with TTL of 1 year (31536000 seconds)
        const key = getCloudSaveKey(deviceId, slot);
        await env.TWITCH_CACHE.put(key, saveDataStr, { expirationTtl: 31536000 });

        // Also update the slot list for this device
        await updateSlotList(env, deviceId, slot);

        return new Response(JSON.stringify({ 
            success: true,
            deviceId,
            slot,
            timestamp: saveData.timestamp,
            size: saveDataStr.length,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to save',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle cloud save download
 * GET /cloud/load?slot=default
 * Headers: X-Device-ID
 */
async function handleCloudLoad(request, env) {
    try {
        const deviceId = request.headers.get('X-Device-ID');
        if (!deviceId || !isValidDeviceId(deviceId)) {
            return new Response(JSON.stringify({ 
                error: 'Valid X-Device-ID header required' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = getCloudSaveKey(deviceId, slot);
        const saveDataStr = await env.TWITCH_CACHE.get(key);

        if (!saveDataStr) {
            return new Response(JSON.stringify({ 
                error: 'Save not found',
                deviceId,
                slot 
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const saveData = JSON.parse(saveDataStr);

        return new Response(JSON.stringify({ 
            success: true,
            data: saveData,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to load',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle listing all save slots for a device
 * GET /cloud/list
 * Headers: X-Device-ID
 */
async function handleCloudList(request, env) {
    try {
        const deviceId = request.headers.get('X-Device-ID');
        if (!deviceId || !isValidDeviceId(deviceId)) {
            return new Response(JSON.stringify({ 
                error: 'Valid X-Device-ID header required' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const slotListKey = `cloudsave_${deviceId}_slots`;
        const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
        const slots = slotsStr ? JSON.parse(slotsStr) : [];

        // Load metadata for each slot
        const saveList = [];
        for (const slot of slots) {
            const key = getCloudSaveKey(deviceId, slot);
            const saveDataStr = await env.TWITCH_CACHE.get(key);
            if (saveDataStr) {
                try {
                    const saveData = JSON.parse(saveDataStr);
                    saveList.push({
                        slot: saveData.slot,
                        timestamp: saveData.timestamp,
                        version: saveData.version,
                        size: saveDataStr.length,
                        configCount: Object.keys(saveData.configs || {}).length,
                    });
                } catch (e) {
                    // Skip corrupted saves
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true,
            deviceId,
            saves: saveList,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to list saves',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle deleting a save slot
 * DELETE /cloud/delete?slot=default
 * Headers: X-Device-ID
 */
async function handleCloudDelete(request, env) {
    try {
        const deviceId = request.headers.get('X-Device-ID');
        if (!deviceId || !isValidDeviceId(deviceId)) {
            return new Response(JSON.stringify({ 
                error: 'Valid X-Device-ID header required' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = getCloudSaveKey(deviceId, slot);
        await env.TWITCH_CACHE.delete(key);

        // Remove from slot list
        await removeFromSlotList(env, deviceId, slot);

        return new Response(JSON.stringify({ 
            success: true,
            deviceId,
            slot,
            message: 'Save deleted',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to delete',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update the slot list for a device
 * @param {*} env 
 * @param {string} deviceId 
 * @param {string} slot 
 */
async function updateSlotList(env, deviceId, slot) {
    const slotListKey = `cloudsave_${deviceId}_slots`;
    const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
    const slots = slotsStr ? JSON.parse(slotsStr) : [];
    
    if (!slots.includes(slot)) {
        slots.push(slot);
        await env.TWITCH_CACHE.put(slotListKey, JSON.stringify(slots), { expirationTtl: 31536000 });
    }
}

/**
 * Remove a slot from the device's slot list
 * @param {*} env 
 * @param {string} deviceId 
 * @param {string} slot 
 */
async function removeFromSlotList(env, deviceId, slot) {
    const slotListKey = `cloudsave_${deviceId}_slots`;
    const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
    const slots = slotsStr ? JSON.parse(slotsStr) : [];
    
    const filtered = slots.filter(s => s !== slot);
    if (filtered.length > 0) {
        await env.TWITCH_CACHE.put(slotListKey, JSON.stringify(filtered), { expirationTtl: 31536000 });
    } else {
        await env.TWITCH_CACHE.delete(slotListKey);
    }
}

/**
 * Test email sending endpoint
 * GET /test/email?to=your@email.com
 */
async function handleTestEmail(request, env) {
    try {
        const url = new URL(request.url);
        const to = url.searchParams.get('to');
        
        if (!to) {
            return new Response(JSON.stringify({ error: 'to parameter required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Check if RESEND_API_KEY is configured
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'RESEND_API_KEY not configured',
                message: 'Please add RESEND_API_KEY secret using: wrangler secret put RESEND_API_KEY'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Send test email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev', // Use your verified domain if you have one
                to: to,
                subject: 'Test Email from Strixun Stream Suite',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>✅ Test Email Successful!</h1>
                            <div class="success">
                                <p><strong>If you're reading this, Resend is working correctly!</strong></p>
                                <p>This is a test email from your Cloudflare Worker.</p>
                            </div>
                            <p>Your email integration is set up and ready to use for OTP authentication.</p>
                            <hr>
                            <p style="font-size: 12px; color: #666;">
                                Strixun Stream Suite - Email Test<br>
                                Sent from Cloudflare Worker
                            </p>
                        </div>
                    </body>
                    </html>
                `,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            return new Response(JSON.stringify({ 
                error: 'Failed to send email',
                status: response.status,
                details: errorData
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const data = await response.json();
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Test email sent successfully!',
            emailId: data.id,
            to: to,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to send email',
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Twitch API endpoints
            if (path === '/clips') return handleClips(request, env);
            if (path === '/following') return handleFollowing(request, env);
            if (path === '/game') return handleGame(request, env);
            if (path === '/user') return handleUser(request, env);
            
            // Cloud Storage endpoints
            if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env);
            if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env);
            if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env);
            if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env);
            
            // CDN endpoints
            if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer();
            
            // Test endpoints
            if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
            
            // Health check
            if (path === '/health' || path === '/') return handleHealth(env);
            
            // Not found
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    },
};

