/**
 * Strixun Stream Suite - Twitch API Integration Module
 * 
 * Handles Twitch API configuration and OAuth:
 * - Client ID management (auto-configured or manual override)
 * - OAuth URL generation
 * - Settings persistence
 * - API connection testing
 * 
 * @version 1.0.0
 */

// Get Twitch Client ID (auto-configured from deployment or manual override)
function getTwitchClientId() {
    // Priority 1: Manual override
    const manual = storage.get('twitch_client_id');
    if (manual) return manual;
    
    // Priority 2: Auto-injected from deployment
    if (typeof window.STRIXUN_CONFIG !== 'undefined' && window.STRIXUN_CONFIG.TWITCH_CLIENT_ID) {
        const injected = window.STRIXUN_CONFIG.TWITCH_CLIENT_ID;
        if (injected && !injected.startsWith('%%')) {
            return injected;
        }
    }
    
    return '';
}

// OAuth callback URL - uses DEFAULT_OAUTH_CALLBACK from version module
function getTwitchOAuthCallback() {
    // Use DEFAULT_OAUTH_CALLBACK from version module if available
    if (typeof DEFAULT_OAUTH_CALLBACK !== 'undefined') {
        return DEFAULT_OAUTH_CALLBACK;
    }
    // Fallback if version module not loaded
    if (window.Version && window.Version.DEFAULT_OAUTH_CALLBACK) {
        return window.Version.DEFAULT_OAUTH_CALLBACK;
    }
    // Hardcoded fallback - custom domain
    return 'https://streamkit.idling.app/twitch_auth_callback.html';
}

// Generate dynamic OAuth URL using configured values
function getTwitchAuthUrl() {
    const clientId = getTwitchClientId();
    const callback = getTwitchOAuthCallback();
    
    if (!clientId || !callback) {
        return null; // Configuration required
    }
    
    const scopes = 'chat:read+chat:edit+user:read:follows+moderator:read:followers';
    return `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(callback)}&scope=${scopes}&force_verify=true`;
}

// Save Twitch settings to storage
function saveTwitchSettings() {
    const clientIdEl = document.getElementById('twitchClientId');
    const apiServerEl = document.getElementById('twitchApiServer');
    
    if (!clientIdEl || !apiServerEl) return;
    
    const clientId = clientIdEl.value.trim();
    const apiServer = apiServerEl.value.trim();
    
    storage.set('twitch_client_id', clientId);
    storage.set('twitch_api_server', apiServer);
    
    const statusEl = document.getElementById('twitchApiStatus');
    if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--success)">[SUCCESS] Settings saved!</span>';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
    }
    
    log('Twitch API settings saved', 'success');
}

// Load Twitch settings into form
function loadTwitchSettings() {
    const clientIdEl = document.getElementById('twitchClientId');
    const apiServerEl = document.getElementById('twitchApiServer');
    const autoDetectedApiEl = document.getElementById('autoDetectedApiUrl');
    const autoDetectedClientEl = document.getElementById('autoDetectedClientId');
    
    // Show manual Client ID override only (if set)
    const manualClientId = storage.get('twitch_client_id') || '';
    if (clientIdEl) clientIdEl.value = manualClientId;
    
    // Show auto-detected Client ID
    if (autoDetectedClientEl) {
        const autoClientId = window.STRIXUN_CONFIG?.TWITCH_CLIENT_ID;
        if (autoClientId && !autoClientId.startsWith('%%') && !manualClientId) {
            const masked = autoClientId.substring(0, 8) + '...' + autoClientId.substring(autoClientId.length - 4);
            autoDetectedClientEl.innerHTML = `[SUCCESS] Auto-configured: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${masked}</code>`;
        } else if (autoClientId && !autoClientId.startsWith('%%') && manualClientId) {
            autoDetectedClientEl.innerHTML = `[INFO] Auto-configured but overridden with manual value`;
        } else {
            autoDetectedClientEl.innerHTML = `[WARNING] Not auto-configured. Add TWITCH_CLIENT_ID to GitHub Secrets.`;
        }
    }
    
    // Show manual API Server override only (if set)
    const manualOverride = storage.get('twitch_api_server') || '';
    if (apiServerEl) apiServerEl.value = manualOverride;
    
    // Show auto-detected API URL
    if (autoDetectedApiEl && typeof window.getWorkerApiUrl === 'function') {
        const autoUrl = window.getWorkerApiUrl();
        if (autoUrl && !manualOverride) {
            autoDetectedApiEl.innerHTML = `[SUCCESS] Auto-detected: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${autoUrl}</code>`;
        } else if (autoUrl && manualOverride) {
            autoDetectedApiEl.innerHTML = `[INFO] Auto-detected: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${autoUrl}</code> (overridden)`;
        } else {
            autoDetectedApiEl.innerHTML = `[WARNING] No auto-detected URL. Deploy via GitHub Actions or configure manually.`;
        }
    }
}

// Test Twitch API connection
async function testTwitchApi() {
    // Get API server URL
    let apiServer = '';
    if (typeof window.getWorkerApiUrl === 'function') {
        apiServer = window.getWorkerApiUrl() || '';
    }
    if (!apiServer) {
        apiServer = storage.get('twitch_api_server') || '';
    }
    
    const statusEl = document.getElementById('twitchApiStatus');
    
    if (!apiServer) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">[ERROR] API Server URL not configured</span>';
        return;
    }
    
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--muted)">[EMOJI] Testing connection...</span>';
    
    try {
        const response = await fetch(`${apiServer}/health`, { 
            method: 'GET',
            cache: 'no-store'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">[SUCCESS] Connected! ${data.message || 'API is healthy'}</span>`;
            log('Twitch API test: Connected successfully', 'success');
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)">[ERROR] Failed: ${err.message}</span>`;
        log(`Twitch API test failed: ${err.message}`, 'error');
    }
}

// Open Twitch OAuth URL (OBS dock compatible)
function openTwitchAuth() {
    const authUrl = getTwitchAuthUrl();
    
    if (!authUrl) {
        log('[WARNING] Twitch Client ID not available. Deploy via GitHub Actions or check GitHub Secrets.', 'error');
        alert('Twitch Client ID not available!\n\nIf deployed via GitHub Pages, ensure TWITCH_CLIENT_ID is added to GitHub Secrets.\n\nOtherwise, you can manually add it in Setup [EMOJI] Twitch API Settings.');
        return;
    }
    
    // Try to open - this works in regular browsers but not OBS docks
    const win = window.open(authUrl, '_blank');
    
    // If it failed or we're in OBS dock, copy to clipboard instead
    if (!win || win.closed || typeof win.closed === 'undefined') {
        copyTwitchAuthUrl();
    }
}

// Copy Twitch OAuth URL to clipboard
function copyTwitchAuthUrl() {
    const authUrl = getTwitchAuthUrl();
    
    if (!authUrl) {
        log('[WARNING] Twitch Client ID not available. Deploy via GitHub Actions or check GitHub Secrets.', 'error');
        alert('Twitch Client ID not available!\n\nIf deployed via GitHub Pages, ensure TWITCH_CLIENT_ID is added to GitHub Secrets.\n\nOtherwise, you can manually add it in Setup [EMOJI] Twitch API Settings.');
        return;
    }
    
    navigator.clipboard.writeText(authUrl).then(() => {
        // Show the hint about OBS dock limitation
        const hint = document.getElementById('twitchAuthHint');
        if (hint) {
            hint.style.display = 'block';
            // Auto-hide after 10 seconds
            setTimeout(() => { hint.style.display = 'none'; }, 10000);
        }
        log('Auth URL copied to clipboard! Paste in your browser.', 'success');
    }).catch(err => {
        log('Failed to copy: ' + err, 'error');
        // Fallback: show the URL in a prompt for manual copy
        prompt('Copy this URL and paste in your browser:', authUrl);
    });
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.TwitchAPI for clarity
if (typeof window !== 'undefined') {
    window.TwitchAPI = {
        getTwitchClientId,
        getTwitchOAuthCallback,
        getTwitchAuthUrl,
        saveTwitchSettings,
        loadTwitchSettings,
        testTwitchApi,
        openTwitchAuth,
        copyTwitchAuthUrl
    };
}

