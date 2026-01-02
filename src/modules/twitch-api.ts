/**
 * Strixun Stream Suite - Twitch API Integration Module
 * 
 * Handles Twitch API configuration and OAuth:
 * - Client ID management (auto-configured or manual override)
 * - OAuth URL generation
 * - Settings persistence
 * - API connection testing
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage';
import { DEFAULT_OAUTH_CALLBACK } from './version';

// ============ Types ============
interface StrixunConfig {
  TWITCH_CLIENT_ID?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    STRIXUN_CONFIG?: StrixunConfig;
    getWorkerApiUrl?: () => string;
  }
}

// ============ Functions ============

/**
 * Log function (uses global log if available, otherwise console)
 */
function log(msg: string, type: string = 'info'): void {
  if ((window as any).App?.log) {
    (window as any).App.log(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}

/**
 * Get Twitch Client ID (auto-configured from deployment or manual override)
 */
export function getTwitchClientId(): string {
  // Priority 1: Manual override
  const manual = storage.get('twitch_client_id') as string | null;
  if (manual) return manual;
  
  // Priority 2: Auto-injected from deployment
  if (window.STRIXUN_CONFIG?.TWITCH_CLIENT_ID) {
    const injected = window.STRIXUN_CONFIG.TWITCH_CLIENT_ID;
    if (injected && !injected.startsWith('%%')) {
      return injected;
    }
  }
  
  return '';
}

/**
 * OAuth callback URL - uses DEFAULT_OAUTH_CALLBACK from version module
 */
export function getTwitchOAuthCallback(): string {
  // Use DEFAULT_OAUTH_CALLBACK from version module
  return DEFAULT_OAUTH_CALLBACK;
}

/**
 * Generate dynamic OAuth URL using configured values
 */
export function getTwitchAuthUrl(): string | null {
  const clientId = getTwitchClientId();
  const callback = getTwitchOAuthCallback();
  
  if (!clientId || !callback) {
    return null; // Configuration required
  }
  
  const scopes = 'chat:read+chat:edit+user:read:follows+moderator:read:followers';
  return `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${encodeURIComponent(callback)}&scope=${scopes}&force_verify=true`;
}

/**
 * Save Twitch settings to storage
 */
export function saveTwitchSettings(): void {
  const clientIdEl = document.getElementById('twitchClientId') as HTMLInputElement | null;
  const apiServerEl = document.getElementById('twitchApiServer') as HTMLInputElement | null;
  
  if (!clientIdEl || !apiServerEl) return;
  
  const clientId = clientIdEl.value.trim();
  const apiServer = apiServerEl.value.trim();
  
  storage.set('twitch_client_id', clientId);
  storage.set('twitch_api_server', apiServer);
  
  const statusEl = document.getElementById('twitchApiStatus') as HTMLElement | null;
  if (statusEl) {
    statusEl.innerHTML = '<span style="color:var(--success)">✓ Settings saved!</span>';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  }
  
  log('Twitch API settings saved', 'success');
}

/**
 * Load Twitch settings into form
 */
export function loadTwitchSettings(): void {
  const clientIdEl = document.getElementById('twitchClientId') as HTMLInputElement | null;
  const apiServerEl = document.getElementById('twitchApiServer') as HTMLInputElement | null;
  const autoDetectedApiEl = document.getElementById('autoDetectedApiUrl') as HTMLElement | null;
  const autoDetectedClientEl = document.getElementById('autoDetectedClientId') as HTMLElement | null;
  
  // Show manual Client ID override only (if set)
  const manualClientId = (storage.get('twitch_client_id') as string) || '';
  if (clientIdEl) clientIdEl.value = manualClientId;
  
  // Show auto-detected Client ID
  if (autoDetectedClientEl) {
    const autoClientId = window.STRIXUN_CONFIG?.TWITCH_CLIENT_ID;
    if (autoClientId && !autoClientId.startsWith('%%') && !manualClientId) {
      const masked = autoClientId.substring(0, 8) + '...' + autoClientId.substring(autoClientId.length - 4);
      autoDetectedClientEl.innerHTML = `✓ Auto-configured: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${masked}</code>`;
    } else if (autoClientId && !autoClientId.startsWith('%%') && manualClientId) {
      autoDetectedClientEl.innerHTML = `ℹ Auto-configured but overridden with manual value`;
    } else {
      autoDetectedClientEl.innerHTML = `⚠ Not auto-configured. Add TWITCH_CLIENT_ID to GitHub Secrets.`;
    }
  }
  
  // Show manual API Server override only (if set)
  const manualOverride = (storage.get('twitch_api_server') as string) || '';
  if (apiServerEl) apiServerEl.value = manualOverride;
  
  // Show auto-detected API URL
  if (autoDetectedApiEl && typeof window.getWorkerApiUrl === 'function') {
    const autoUrl = window.getWorkerApiUrl();
    if (autoUrl && !manualOverride) {
      autoDetectedApiEl.innerHTML = `✓ Auto-detected: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${autoUrl}</code>`;
    } else if (autoUrl && manualOverride) {
      autoDetectedApiEl.innerHTML = `ℹ Auto-detected: <code style="background:var(--bg);padding:2px 6px;border-radius:3px">${autoUrl}</code> (overridden)`;
    } else {
      autoDetectedApiEl.innerHTML = `⚠ No auto-detected URL. Deploy via GitHub Actions or configure manually.`;
    }
  }
}

/**
 * Test Twitch API connection
 */
export async function testTwitchApi(): Promise<void> {
  // Get API server URL
  let apiServer = '';
  if (typeof window.getWorkerApiUrl === 'function') {
    apiServer = window.getWorkerApiUrl() || '';
  }
  if (!apiServer) {
    apiServer = (storage.get('twitch_api_server') as string) || '';
  }
  
  const statusEl = document.getElementById('twitchApiStatus') as HTMLElement | null;
  
  if (!apiServer) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">✗ API Server URL not configured</span>';
    return;
  }
  
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--muted)"> Testing connection...</span>';
  
  try {
    const response = await fetch(`${apiServer}/health`, { 
      method: 'GET',
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json() as { message?: string };
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--success)">✓ Connected! ${data.message || 'API is healthy'}</span>`;
      log('Twitch API test: Connected successfully', 'success');
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    const error = err as Error;
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger)">✗ Failed: ${error.message}</span>`;
    log(`Twitch API test failed: ${error.message}`, 'error');
  }
}

/**
 * Open Twitch OAuth URL (OBS dock compatible)
 */
export function openTwitchAuth(): void {
  const authUrl = getTwitchAuthUrl();
  
  if (!authUrl) {
    log('⚠ Twitch Client ID not available. Deploy via GitHub Actions or check GitHub Secrets.', 'error');
    alert('Twitch Client ID not available!\n\nIf deployed via GitHub Pages, ensure TWITCH_CLIENT_ID is added to GitHub Secrets.\n\nOtherwise, you can manually add it in Setup  Twitch API Settings.');
    return;
  }
  
  // Try to open - this works in regular browsers but not OBS docks
  const win = window.open(authUrl, '_blank');
  
  // If it failed or we're in OBS dock, copy to clipboard instead
  if (!win || win.closed || typeof win.closed === 'undefined') {
    copyTwitchAuthUrl();
  }
}

/**
 * Copy Twitch OAuth URL to clipboard
 */
export function copyTwitchAuthUrl(): void {
  const authUrl = getTwitchAuthUrl();
  
  if (!authUrl) {
    log('⚠ Twitch Client ID not available. Deploy via GitHub Actions or check GitHub Secrets.', 'error');
    alert('Twitch Client ID not available!\n\nIf deployed via GitHub Pages, ensure TWITCH_CLIENT_ID is added to GitHub Secrets.\n\nOtherwise, you can manually add it in Setup  Twitch API Settings.');
    return;
  }
  
  navigator.clipboard.writeText(authUrl).then(() => {
    // Show the hint about OBS dock limitation
    const hint = document.getElementById('twitchAuthHint') as HTMLElement | null;
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

// ============ Exports ============
export const TwitchAPI = {
  getTwitchClientId,
  getTwitchOAuthCallback,
  getTwitchAuthUrl,
  saveTwitchSettings,
  loadTwitchSettings,
  testTwitchApi,
  openTwitchAuth,
  copyTwitchAuthUrl
};

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).TwitchAPI = TwitchAPI;
}

