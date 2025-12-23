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
 * - Email OTP Authentication System (secure user authentication)
 * 
 * @version 2.1.0
 */

// CORS headers for cross-origin requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-ID, X-Requested-With',
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
 * Handle authenticated cloud save upload
 * POST /cloud-save/save?slot=default
 * Headers: Authorization: Bearer {token}
 * Body: { backup: StorageBackup, metadata?: { name?: string, description?: string } }
 */
async function handleCloudSave(request, env) {
    try {
        // Authenticate request
        const authResult = await authenticateRequest(request, env);
        if (!authResult.authenticated) {
            return new Response(JSON.stringify({ error: authResult.error }), {
                status: authResult.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const userId = authResult.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';
        
        // Validate slot name
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(slot)) {
            return new Response(JSON.stringify({ error: 'Invalid slot name (1-32 alphanumeric chars)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse body
        const body = await request.json();
        const backup = body.backup;
        
        if (!backup || !backup.version || !backup.timestamp) {
            return new Response(JSON.stringify({ error: 'Invalid backup data format' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Create save data with metadata
        const saveData = {
            version: backup.version || 2,
            userId,
            slot,
            timestamp: new Date().toISOString(),
            backupTimestamp: backup.timestamp,
            userAgent: request.headers.get('User-Agent') || 'unknown',
            backup: backup, // Full StorageBackup object
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
        const key = `cloudsave_${userId}_${slot}`;
        await env.TWITCH_CACHE.put(key, saveDataStr, { expirationTtl: 31536000 });

        // Also update the slot list for this user
        await updateCloudSaveSlotList(env, userId, slot, saveData.metadata);

        return new Response(JSON.stringify({ 
            success: true,
            userId,
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
 * Handle authenticated cloud save download
 * GET /cloud-save/load?slot=default
 * Headers: Authorization: Bearer {token}
 */
async function handleCloudLoad(request, env) {
    try {
        // Authenticate request
        const authResult = await authenticateRequest(request, env);
        if (!authResult.authenticated) {
            return new Response(JSON.stringify({ error: authResult.error }), {
                status: authResult.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const userId = authResult.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = `cloudsave_${userId}_${slot}`;
        const saveDataStr = await env.TWITCH_CACHE.get(key);

        if (!saveDataStr) {
            return new Response(JSON.stringify({ 
                error: 'Save not found',
                userId,
                slot 
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const saveData = JSON.parse(saveDataStr);

        return new Response(JSON.stringify({ 
            success: true,
            backup: saveData.backup,
            metadata: saveData.metadata,
            timestamp: saveData.timestamp,
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
 * Handle listing all save slots for authenticated user
 * GET /cloud-save/list
 * Headers: Authorization: Bearer {token}
 */
async function handleCloudList(request, env) {
    try {
        // Authenticate request
        const authResult = await authenticateRequest(request, env);
        if (!authResult.authenticated) {
            return new Response(JSON.stringify({ error: authResult.error }), {
                status: authResult.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const userId = authResult.userId;
        const slotListKey = `cloudsave_${userId}_slots`;
        const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
        const slots = slotsStr ? JSON.parse(slotsStr) : [];

        // Load metadata for each slot
        const saveList = [];
        for (const slot of slots) {
            const key = `cloudsave_${userId}_${slot}`;
            const saveDataStr = await env.TWITCH_CACHE.get(key);
            if (saveDataStr) {
                try {
                    const saveData = JSON.parse(saveDataStr);
                    const backup = saveData.backup || {};
                    saveList.push({
                        slot: saveData.slot,
                        timestamp: saveData.timestamp,
                        backupTimestamp: saveData.backupTimestamp,
                        version: saveData.version,
                        size: saveDataStr.length,
                        metadata: saveData.metadata || {},
                        exportedCategories: backup.exportedCategories || [],
                    });
                } catch (e) {
                    // Skip corrupted saves
                }
            }
        }

        // Sort by timestamp descending
        saveList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return new Response(JSON.stringify({ 
            success: true,
            userId,
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
 * Update slot list for user
 */
async function updateCloudSaveSlotList(env, userId, slot, metadata) {
    const slotListKey = `cloudsave_${userId}_slots`;
    const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
    const slots = slotsStr ? JSON.parse(slotsStr) : [];
    
    // Add slot if not exists
    if (!slots.includes(slot)) {
        slots.push(slot);
    }
    
    // Store updated list
    await env.TWITCH_CACHE.put(slotListKey, JSON.stringify(slots), { expirationTtl: 31536000 });
}

/**
 * Handle deleting an authenticated save slot
 * DELETE /cloud-save/delete?slot=default
 * Headers: Authorization: Bearer {token}
 */
async function handleCloudDelete(request, env) {
    try {
        // Authenticate request
        const authResult = await authenticateRequest(request, env);
        if (!authResult.authenticated) {
            return new Response(JSON.stringify({ error: authResult.error }), {
                status: authResult.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const userId = authResult.userId;
        const url = new URL(request.url);
        const slot = url.searchParams.get('slot') || 'default';

        const key = `cloudsave_${userId}_${slot}`;
        await env.TWITCH_CACHE.delete(key);

        // Remove from slot list
        const slotListKey = `cloudsave_${userId}_slots`;
        const slotsStr = await env.TWITCH_CACHE.get(slotListKey);
        if (slotsStr) {
            const slots = JSON.parse(slotsStr);
            const filtered = slots.filter(s => s !== slot);
            if (filtered.length > 0) {
                await env.TWITCH_CACHE.put(slotListKey, JSON.stringify(filtered), { expirationTtl: 31536000 });
            } else {
                await env.TWITCH_CACHE.delete(slotListKey);
            }
        }

        return new Response(JSON.stringify({ 
            success: true,
            userId,
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

// ============ Authentication System ============

/**
 * Generate secure 6-digit OTP
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    // Generate 6-digit number (000000-999999)
    const otp = (array[0] % 1000000).toString().padStart(6, '0');
    return otp;
}

/**
 * Hash email for storage key (SHA-256)
 * @param {string} email - Email address
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate user ID from email
 * @param {string} email - Email address
 * @returns {Promise<string>} User ID
 */
async function generateUserId(email) {
    const hash = await hashEmail(email);
    return `user_${hash.substring(0, 12)}`;
}

/**
 * Create JWT token
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} JWT token
 */
async function createJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${signatureInput}.${signatureB64}`;
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for verification
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
async function verifyJWT(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [headerB64, payloadB64, signatureB64] = parts;
        
        // Verify signature
        const encoder = new TextEncoder();
        const signatureInput = `${headerB64}.${payloadB64}`;
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // Decode signature
        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(signatureInput)
        );
        
        if (!isValid) return null;
        
        // Decode payload
        const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
        );
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Get JWT secret from environment or generate default
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 */
function getJWTSecret(env) {
    // Use environment secret if available, otherwise use a default (not recommended for production)
    return env.JWT_SECRET || 'strixun-stream-suite-default-secret-change-in-production';
}

/**
 * Check rate limit for OTP requests
 * @param {string} emailHash - Hashed email
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
async function checkOTPRateLimit(emailHash, env) {
    try {
        const rateLimitKey = `ratelimit_otp_${emailHash}`;
        const rateLimitData = await env.TWITCH_CACHE.get(rateLimitKey);
        let rateLimit = null;
        
        if (rateLimitData) {
            try {
                rateLimit = typeof rateLimitData === 'string' ? JSON.parse(rateLimitData) : rateLimitData;
            } catch (e) {
                // Invalid JSON, treat as no rate limit
                rateLimit = null;
            }
        }
        
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Check if rate limit exists and is still valid
        if (rateLimit && rateLimit.resetAt && now <= new Date(rateLimit.resetAt).getTime()) {
            // Rate limit exists and is valid
            if (rateLimit.otpRequests >= 3) {
                return { allowed: false, remaining: 0, resetAt: rateLimit.resetAt };
            }
            
            // Increment counter (this request counts)
            rateLimit.otpRequests = (rateLimit.otpRequests || 0) + 1;
            await env.TWITCH_CACHE.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
            
            return { allowed: true, remaining: 3 - rateLimit.otpRequests, resetAt: rateLimit.resetAt };
        }
        
        // No rate limit or expired - create new one (this request counts as 1)
        const resetAt = new Date(now + oneHour).toISOString();
        const newRateLimit = {
            otpRequests: 1,
            failedAttempts: 0,
            resetAt: resetAt
        };
        await env.TWITCH_CACHE.put(rateLimitKey, JSON.stringify(newRateLimit), { expirationTtl: 3600 });
        
        return { allowed: true, remaining: 2, resetAt: resetAt };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request (fail open for availability)
        return { allowed: true, remaining: 3, resetAt: new Date(Date.now() + 3600000).toISOString() };
    }
}

/**
 * Send OTP email via Resend
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Resend API response
 */
async function sendOTPEmail(email, otp, env) {
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', // Use your verified domain email
            to: email,
            subject: 'Your Verification Code - Strixun Stream Suite',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .otp-code { 
                            font-size: 32px; 
                            font-weight: bold; 
                            letter-spacing: 8px; 
                            text-align: center;
                            background: #f4f4f4;
                            padding: 20px;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-family: monospace;
                        }
                        .footer { 
                            margin-top: 30px; 
                            font-size: 12px; 
                            color: #666; 
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Your Verification Code</h1>
                        <p>Use this code to verify your email address:</p>
                        <div class="otp-code">${otp}</div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p>If you didn't request this code, please ignore this email.</p>
                        <div class="footer">
                            <p>Strixun Stream Suite</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
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
        console.error('Resend API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
        });
        throw new Error(`Resend API error: ${response.status} - ${errorData.message || errorText}`);
    }
    
    const result = await response.json();
    console.log('Email sent successfully via Resend:', result);
    return result;
}

/**
 * Request OTP endpoint
 * POST /auth/request-otp
 */
async function handleRequestOTP(request, env) {
    try {
        const body = await request.json();
        const { email } = body;
        
        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Check rate limit
        const emailHash = await hashEmail(email);
        const rateLimit = await checkOTPRateLimit(emailHash, env);
        
        if (!rateLimit.allowed) {
            return new Response(JSON.stringify({ 
                error: 'Too many requests. Please try again later.',
                resetAt: rateLimit.resetAt,
                remaining: rateLimit.remaining
            }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Generate OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        // Store OTP in KV
        const otpKey = `otp_${emailHash}_${Date.now()}`;
        await env.TWITCH_CACHE.put(otpKey, JSON.stringify({
            email: email.toLowerCase().trim(),
            otp,
            expiresAt: expiresAt.toISOString(),
            attempts: 0,
        }), { expirationTtl: 600 }); // 10 minutes TTL
        
        // Also store latest OTP for quick lookup (overwrites previous)
        const latestOtpKey = `otp_latest_${emailHash}`;
        await env.TWITCH_CACHE.put(latestOtpKey, otpKey, { expirationTtl: 600 });
        
        // Send email
        try {
            const emailResult = await sendOTPEmail(email, otp, env);
            console.log('OTP email sent successfully:', emailResult);
        } catch (error) {
            // Log the full error for debugging
            console.error('Failed to send OTP email:', {
                message: error.message,
                stack: error.stack,
                email: email.toLowerCase().trim(),
                hasResendKey: !!env.RESEND_API_KEY
            });
            // Return error so user knows email failed
            return new Response(JSON.stringify({ 
                error: 'Failed to send email. Please check your email address and try again.',
                details: env.ENVIRONMENT === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'OTP sent to email',
            expiresIn: 600,
            remaining: rateLimit.remaining
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('OTP request error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return new Response(JSON.stringify({ 
            error: 'Failed to request OTP',
            message: error.message,
            details: env.ENVIRONMENT === 'development' ? error.stack : undefined
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Verify OTP endpoint
 * POST /auth/verify-otp
 */
async function handleVerifyOTP(request, env) {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        // Validate input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        if (!otp || !/^\d{6}$/.test(otp)) {
            return new Response(JSON.stringify({ error: 'Valid 6-digit OTP required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(email);
        const emailLower = email.toLowerCase().trim();
        
        // Get latest OTP key
        const latestOtpKey = await env.TWITCH_CACHE.get(`otp_latest_${emailHash}`);
        if (!latestOtpKey) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Get OTP data
        const otpDataStr = await env.TWITCH_CACHE.get(latestOtpKey);
        if (!otpDataStr) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const otpData = JSON.parse(otpDataStr);
        
        // Verify email matches
        if (otpData.email !== emailLower) {
            return new Response(JSON.stringify({ error: 'Invalid OTP' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(otpData.expiresAt) < new Date()) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'OTP expired' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Check attempts
        if (otpData.attempts >= 5) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'Too many failed attempts' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Verify OTP
        if (otpData.otp !== otp) {
            otpData.attempts++;
            await env.TWITCH_CACHE.put(latestOtpKey, JSON.stringify(otpData), { expirationTtl: 600 });
            return new Response(JSON.stringify({ 
                error: 'Invalid OTP',
                remainingAttempts: 5 - otpData.attempts
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // OTP is valid! Delete it (single-use)
        await env.TWITCH_CACHE.delete(latestOtpKey);
        await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
        
        // Get or create user
        const userId = await generateUserId(emailLower);
        const userKey = `user_${emailHash}`;
        let user = await env.TWITCH_CACHE.get(userKey, { type: 'json' });
        
        if (!user) {
            // Create new user
            user = {
                userId,
                email: emailLower,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 }); // 1 year
        } else {
            // Update last login
            user.lastLogin = new Date().toISOString();
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        }
        
        // Generate JWT token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const tokenPayload = {
            userId,
            email: emailLower,
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const jwtSecret = getJWTSecret(env);
        const token = await createJWT(tokenPayload, jwtSecret);
        
        // Store session
        const sessionKey = `session_${userId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId,
            email: emailLower,
            token: await hashEmail(token), // Store hash of token
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 2592000 }); // 30 days
        
        return new Response(JSON.stringify({ 
            success: true,
            token,
            userId,
            email: emailLower,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to verify OTP',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get current user endpoint
 * GET /auth/me
 */
async function handleGetMe(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Get user data
        const emailHash = await hashEmail(payload.email);
        const userKey = `user_${emailHash}`;
        const user = await env.TWITCH_CACHE.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            userId: user.userId,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to get user info',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Logout endpoint
 * POST /auth/logout
 */
async function handleLogout(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Add token to blacklist
        const tokenHash = await hashEmail(token);
        const blacklistKey = `blacklist_${tokenHash}`;
        await env.TWITCH_CACHE.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 2592000 }); // 30 days (same as token expiry)
        
        // Delete session
        const sessionKey = `session_${payload.userId}`;
        await env.TWITCH_CACHE.delete(sessionKey);
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Refresh token endpoint
 * POST /auth/refresh
 */
async function handleRefresh(request, env) {
    try {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'Token required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Check if token is blacklisted
        const tokenHash = await hashEmail(token);
        const blacklistKey = `blacklist_${tokenHash}`;
        const blacklisted = await env.TWITCH_CACHE.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new token
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const newTokenPayload = {
            userId: payload.userId,
            email: payload.email,
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const newToken = await createJWT(newTokenPayload, jwtSecret);
        
        // Update session
        const sessionKey = `session_${payload.userId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId: payload.userId,
            email: payload.email,
            token: await hashEmail(newToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 2592000 });
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

// ============ Notes/Notebook System ============

/**
 * Authenticate request and get user info
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {Promise<{userId: string, email: string}|null>} User info or null if not authenticated
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);
    
    if (!payload) {
        return null;
    }
    
    // Check if token is blacklisted
    const tokenHash = await hashEmail(token);
    const blacklistKey = `blacklist_${tokenHash}`;
    const blacklisted = await env.TWITCH_CACHE.get(blacklistKey);
    if (blacklisted) {
        return null;
    }
    
    return {
        userId: payload.userId,
        email: payload.email
    };
}

/**
 * Compress content using gzip (client-side compression, but we can also compress server-side)
 * For now, we'll store as-is and rely on KV compression
 * @param {string} content - Content to compress
 * @returns {Promise<string>} Compressed content (base64)
 */
async function compressContent(content) {
    // KV automatically compresses, but we can add explicit compression if needed
    // For now, just return as-is
    return content;
}

/**
 * Get notes storage key
 * @param {string} userId - User ID
 * @param {string} notebookId - Notebook ID
 * @returns {string} Storage key
 */
function getNotesKey(userId, notebookId) {
    return `notes_${userId}_${notebookId}`;
}

/**
 * Get user's notebook list key
 * @param {string} userId - User ID
 * @returns {string} Storage key
 */
function getNotebookListKey(userId) {
    return `notes_list_${userId}`;
}

/**
 * Save notebook endpoint
 * POST /notes/save
 * Requires: Authorization: Bearer {token}
 */
async function handleNotesSave(request, env) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { notebookId, content, metadata } = body;
        
        // Validate input
        if (!notebookId || !/^[a-zA-Z0-9_-]{1,64}$/.test(notebookId)) {
            return new Response(JSON.stringify({ error: 'Valid notebookId required (1-64 alphanumeric chars)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        if (!content) {
            return new Response(JSON.stringify({ error: 'Content required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Validate content size (10MB max)
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        if (contentStr.length > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'Content too large (max 10MB)' }), {
                status: 413,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Create notebook data
        const notebookData = {
            version: 1,
            userId: user.userId,
            notebookId,
            content,
            metadata: {
                title: metadata?.title || 'Untitled',
                lastEdited: new Date().toISOString(),
                createdAt: metadata?.createdAt || new Date().toISOString(),
                ...(metadata || {}),
            },
            timestamp: new Date().toISOString(),
        };
        
        // Store in KV
        const key = getNotesKey(user.userId, notebookId);
        const dataStr = JSON.stringify(notebookData);
        await env.TWITCH_CACHE.put(key, dataStr, { expirationTtl: 31536000 }); // 1 year
        
        // Update notebook list
        const listKey = getNotebookListKey(user.userId);
        let notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' });
        if (!notebookList) {
            notebookList = [];
        }
        
        // Add or update notebook in list
        const existingIndex = notebookList.findIndex(n => n.id === notebookId);
        const notebookInfo = {
            id: notebookId,
            title: notebookData.metadata.title,
            lastEdited: notebookData.metadata.lastEdited,
            createdAt: notebookData.metadata.createdAt,
        };
        
        if (existingIndex >= 0) {
            notebookList[existingIndex] = notebookInfo;
        } else {
            notebookList.push(notebookInfo);
        }
        
        await env.TWITCH_CACHE.put(listKey, JSON.stringify(notebookList), { expirationTtl: 31536000 });
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId,
            timestamp: notebookData.timestamp,
            size: dataStr.length,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to save notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Load notebook endpoint
 * GET /notes/load?notebookId=notebook_1
 * Requires: Authorization: Bearer {token}
 */
async function handleNotesLoad(request, env) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const url = new URL(request.url);
        const notebookId = url.searchParams.get('notebookId');
        
        if (!notebookId) {
            return new Response(JSON.stringify({ error: 'notebookId parameter required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Load from KV
        const key = getNotesKey(user.userId, notebookId);
        const dataStr = await env.TWITCH_CACHE.get(key);
        
        if (!dataStr) {
            return new Response(JSON.stringify({ 
                error: 'Notebook not found',
                notebookId 
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const notebookData = JSON.parse(dataStr);
        
        // Verify ownership
        if (notebookData.userId !== user.userId) {
            return new Response(JSON.stringify({ error: 'Access denied' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId: notebookData.notebookId,
            content: notebookData.content,
            metadata: notebookData.metadata,
            timestamp: notebookData.timestamp,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to load notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * List notebooks endpoint
 * GET /notes/list
 * Requires: Authorization: Bearer {token}
 */
async function handleNotesList(request, env) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Load notebook list
        const listKey = getNotebookListKey(user.userId);
        const notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' }) || [];
        
        return new Response(JSON.stringify({ 
            success: true,
            notebooks: notebookList,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to list notebooks',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete notebook endpoint
 * DELETE /notes/delete?notebookId=notebook_1
 * Requires: Authorization: Bearer {token}
 */
async function handleNotesDelete(request, env) {
    try {
        // Authenticate
        const user = await authenticateRequest(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const url = new URL(request.url);
        const notebookId = url.searchParams.get('notebookId');
        
        if (!notebookId) {
            return new Response(JSON.stringify({ error: 'notebookId parameter required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Delete notebook
        const key = getNotesKey(user.userId, notebookId);
        await env.TWITCH_CACHE.delete(key);
        
        // Update notebook list
        const listKey = getNotebookListKey(user.userId);
        let notebookList = await env.TWITCH_CACHE.get(listKey, { type: 'json' });
        if (notebookList) {
            notebookList = notebookList.filter(n => n.id !== notebookId);
            if (notebookList.length > 0) {
                await env.TWITCH_CACHE.put(listKey, JSON.stringify(notebookList), { expirationTtl: 31536000 });
            } else {
                await env.TWITCH_CACHE.delete(listKey);
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            notebookId,
            message: 'Notebook deleted',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to delete notebook',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
                from: env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', // Use your verified domain email
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
            // Authenticated cloud save endpoints (replaces device-based /cloud/*)
            if (path === '/cloud-save/save' && request.method === 'POST') return handleCloudSave(request, env);
            if (path === '/cloud-save/load' && request.method === 'GET') return handleCloudLoad(request, env);
            if (path === '/cloud-save/list' && request.method === 'GET') return handleCloudList(request, env);
            if (path === '/cloud-save/delete' && request.method === 'DELETE') return handleCloudDelete(request, env);
            
            // Legacy device-based endpoints (kept for backward compatibility)
            if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env);
            if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env);
            if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env);
            if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env);
            
            // CDN endpoints
            if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer();
            
            // Authentication endpoints
            if (path === '/auth/request-otp' && request.method === 'POST') return handleRequestOTP(request, env);
            if (path === '/auth/verify-otp' && request.method === 'POST') return handleVerifyOTP(request, env);
            if (path === '/auth/me' && request.method === 'GET') return handleGetMe(request, env);
            if (path === '/auth/logout' && request.method === 'POST') return handleLogout(request, env);
            if (path === '/auth/refresh' && request.method === 'POST') return handleRefresh(request, env);
            
            // Notes/Notebook endpoints (require authentication)
            if (path === '/notes/save' && request.method === 'POST') return handleNotesSave(request, env);
            if (path === '/notes/load' && request.method === 'GET') return handleNotesLoad(request, env);
            if (path === '/notes/list' && request.method === 'GET') return handleNotesList(request, env);
            if (path === '/notes/delete' && request.method === 'DELETE') return handleNotesDelete(request, env);
            
            // Test endpoints
            if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
            
            // Debug: Clear rate limit (for testing)
            if (path === '/debug/clear-rate-limit' && request.method === 'POST') {
                try {
                    const body = await request.json();
                    const { email } = body;
                    if (!email) {
                        return new Response(JSON.stringify({ error: 'email required' }), {
                            status: 400,
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    }
                    const emailHash = await hashEmail(email);
                    const rateLimitKey = `ratelimit_otp_${emailHash}`;
                    await env.TWITCH_CACHE.delete(rateLimitKey);
                    return new Response(JSON.stringify({ success: true, message: 'Rate limit cleared' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ error: error.message }), {
                        status: 500,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }
            
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

