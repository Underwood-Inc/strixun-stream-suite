/**
 * Strixun Stream Suite - Version Management Module
 * 
 * Handles version tracking, comparison, and update checking:
 * - Version constants and parsing
 * - Version comparison utilities
 * - GitHub update checking
 * - Version display initialization
 * 
 * @version 1.0.0
 */

const APP_VERSION = {
    // Component versions - update these when releasing
    controlPanel: '1.3.0',
    sourceAnimations: '2.8.1',
    sourceSwap: '3.1.0',
    sourceLayouts: '1.0.0',
    textCycler: '1.0.0',
    quickControls: '1.0.0',
    scriptManager: '1.3.0'
};

// GitHub repository configuration
const GITHUB_REPO = 'Underwood-Inc/strixun-stream-suite';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;
// Custom domain: streamkit.idling.app
const GITHUB_PAGES_URL = 'https://streamkit.idling.app';

// Default OAuth callback URL (GitHub Pages hosted)
const DEFAULT_OAUTH_CALLBACK = `${GITHUB_PAGES_URL}/twitch_auth_callback.html`;

// Get the main display version (control panel version)
function getLocalVersion() {
    return APP_VERSION.controlPanel;
}

// Parse version string to comparable array
function parseVersion(versionStr) {
    if (!versionStr || typeof versionStr !== 'string') return [0, 0, 0];
    const match = versionStr.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

// Compare two versions: returns -1 if a < b, 0 if a == b, 1 if a > b
function compareVersions(a, b) {
    const vA = parseVersion(a);
    const vB = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (vA[i] < vB[i]) return -1;
        if (vA[i] > vB[i]) return 1;
    }
    return 0;
}

// Update local version display
function updateLocalVersionDisplay() {
    const el = document.getElementById('localVersion');
    if (el) el.textContent = `v${getLocalVersion()}`;
}

// Check for updates from GitHub
async function checkForUpdates() {
    const statusEl = document.getElementById('versionStatus');
    const remoteEl = document.getElementById('remoteVersion');
    const lastCheckEl = document.getElementById('lastVersionCheck');
    
    if (statusEl) {
        statusEl.style.background = 'rgba(255,255,255,0.05)';
        statusEl.innerHTML = '<span style="color:var(--muted)">❓ Checking for updates...</span>';
    }
    
    try {
        // Fetch package.json from GitHub main branch
        const response = await fetch(`${GITHUB_RAW_BASE}/package.json?t=${Date.now()}`, {
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`GitHub fetch failed: ${response.status}`);
        }
        
        const packageJson = await response.json();
        const remoteVersion = packageJson.version || '0.0.0';
        
        if (remoteEl) remoteEl.textContent = `v${remoteVersion}`;
        
        const localVersion = getLocalVersion();
        const comparison = compareVersions(localVersion, remoteVersion);
        
        if (statusEl) {
            if (comparison < 0) {
                // Local is behind remote - update available!
                statusEl.style.background = 'rgba(255,200,0,0.15)';
                statusEl.style.borderLeft = '3px solid var(--warning)';
                statusEl.innerHTML = `
                    <span style="color:var(--warning);font-weight:600">⚠️ Update Available!</span><br>
                    <span style="font-size:0.9em;color:var(--muted)">
                        ${localVersion} ❓ ${remoteVersion}
                    </span>
                `;
            } else if (comparison > 0) {
                // Local is ahead (development version)
                statusEl.style.background = 'rgba(100,200,255,0.15)';
                statusEl.style.borderLeft = '3px solid var(--accent)';
                statusEl.innerHTML = '<span style="color:var(--accent)">🔧 Development Version</span>';
            } else {
                // Up to date
                statusEl.style.background = 'rgba(0,255,100,0.1)';
                statusEl.style.borderLeft = '3px solid var(--success)';
                statusEl.innerHTML = '<span style="color:var(--success)">✅ Up to Date</span>';
            }
        }
        
        // Store last check time
        const now = new Date();
        storage.set('lastVersionCheck', now.toISOString());
        storage.set('lastRemoteVersion', remoteVersion);
        
        if (lastCheckEl) {
            lastCheckEl.textContent = `Last checked: ${now.toLocaleTimeString()}`;
        }
        
        log(`Version check: local v${localVersion}, remote v${remoteVersion}`, comparison < 0 ? 'warning' : 'success');
        
    } catch (err) {
        console.error('[Version] Check failed:', err);
        
        // Try to show cached version if available
        const cachedVersion = storage.get('lastRemoteVersion');
        if (remoteEl && cachedVersion) {
            remoteEl.textContent = `v${cachedVersion} (cached)`;
        } else if (remoteEl) {
            remoteEl.textContent = '(unavailable)';
        }
        
        if (statusEl) {
            statusEl.style.background = 'rgba(255,100,100,0.1)';
            statusEl.style.borderLeft = '3px solid var(--danger)';
            statusEl.innerHTML = `
                <span style="color:var(--danger)">❌ Check Failed</span><br>
                <span style="font-size:0.85em;color:var(--muted)">${err.message}</span>
            `;
        }
        
        log(`Version check failed: ${err.message}`, 'error');
    }
}

// Open GitHub repository
function openGitHubRepo() {
    // Use openUrlOrCopy from script-status module if available, otherwise fallback
    if (typeof openUrlOrCopy === 'function') {
        openUrlOrCopy(GITHUB_REPO_URL, 'GitHub Repository');
    } else if (window.ScriptStatus && typeof window.ScriptStatus.openUrlOrCopy === 'function') {
        window.ScriptStatus.openUrlOrCopy(GITHUB_REPO_URL, 'GitHub Repository');
    } else {
        // Fallback: try to open directly
        const win = window.open(GITHUB_REPO_URL, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            navigator.clipboard.writeText(GITHUB_REPO_URL).then(() => {
                log('GitHub Repository URL copied to clipboard!', 'info');
            }).catch(() => {
                prompt('Copy this URL:', GITHUB_REPO_URL);
            });
        }
    }
}

// Initialize version display on load
function initVersionDisplay() {
    updateLocalVersionDisplay();
    
    // Show cached data if available
    const lastCheck = storage.get('lastVersionCheck');
    const cachedVersion = storage.get('lastRemoteVersion');
    const lastCheckEl = document.getElementById('lastVersionCheck');
    const remoteEl = document.getElementById('remoteVersion');
    
    if (lastCheck && lastCheckEl) {
        const date = new Date(lastCheck);
        lastCheckEl.textContent = `Last checked: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    }
    
    if (cachedVersion && remoteEl) {
        remoteEl.textContent = `v${cachedVersion} (cached)`;
        
        // Show cached comparison
        const comparison = compareVersions(getLocalVersion(), cachedVersion);
        const statusEl = document.getElementById('versionStatus');
        if (statusEl && comparison < 0) {
            statusEl.style.background = 'rgba(255,200,0,0.15)';
            statusEl.style.borderLeft = '3px solid var(--warning)';
            statusEl.innerHTML = `
                <span style="color:var(--warning);font-weight:600">⚠️ Update May Be Available</span><br>
                <span style="font-size:0.85em;color:var(--muted)">(cached - click to refresh)</span>
            `;
        }
    }
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.Version for clarity
if (typeof window !== 'undefined') {
    window.Version = {
        getLocalVersion,
        parseVersion,
        compareVersions,
        updateLocalVersionDisplay,
        checkForUpdates,
        openGitHubRepo,
        initVersionDisplay,
        // Constants
        get APP_VERSION() { return APP_VERSION; },
        get GITHUB_REPO() { return GITHUB_REPO; },
        get GITHUB_REPO_URL() { return GITHUB_REPO_URL; },
        get GITHUB_PAGES_URL() { return GITHUB_PAGES_URL; },
        get DEFAULT_OAUTH_CALLBACK() { return DEFAULT_OAUTH_CALLBACK; }
    };
}

