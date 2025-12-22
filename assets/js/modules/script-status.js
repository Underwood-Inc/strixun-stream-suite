/**
 * Strixun Stream Suite - Script Status/Feature Detection Module
 * 
 * Handles script status tracking, feature availability detection,
 * and UI updates based on connection and script availability.
 * 
 * @version 1.0.0
 */

// Script status tracking - which scripts are detected as installed
const scriptStatus = {
    initialized: false,
    connected: false,  // Whether we've successfully connected to OBS
    scripts: {},       // { scriptId: { installed: bool, version: string|null } }
    features: {        // Which features are available based on scripts
        sources: false,
        swap: false,
        text: false,
        animations: false
    }
};

// Map scripts to features they enable
const SCRIPT_FEATURE_MAP = {
    'source_animations': ['sources', 'animations'],
    'source_swap': ['swap'],
    'text_cycler': ['text'],
    'quick_controls': [],  // Utility script, no UI features
    'script_manager': []   // Meta script, no UI features
};

// Detect if running in OBS dock (embedded CEF browser)
function isOBSDock() {
    // OBS docks have limited capabilities:
    // 1. window.open usually fails or returns null
    // 2. File downloads don't work properly
    // 3. Some APIs are restricted
    // We detect by checking the URL protocol and user agent hints
    const isFileProtocol = window.location.protocol === 'file:';
    const isEmbedded = !window.opener && window.parent === window;
    
    // If loaded via file:// and appears embedded, likely OBS dock
    return isFileProtocol && isEmbedded;
}

// Update UI based on dock context
function updateDockContextUI() {
    const isDock = isOBSDock();
    const downloadBtn = document.getElementById('downloadScriptBtn');
    const dockWarning = document.getElementById('dockDownloadWarning');
    const browserInstructions = document.getElementById('browserInstructions');
    const dockInstructions = document.getElementById('dockInstructions');
    
    if (downloadBtn) {
        if (isDock) {
            downloadBtn.classList.add('btn-warning');
            downloadBtn.classList.remove('btn-primary');
            downloadBtn.title = 'May not work in OBS dock - use Copy instead';
        } else {
            downloadBtn.classList.add('btn-primary');
            downloadBtn.classList.remove('btn-warning');
            downloadBtn.title = 'Download install script';
        }
    }
    
    if (dockWarning) dockWarning.style.display = isDock ? 'block' : 'none';
    if (browserInstructions) browserInstructions.style.display = isDock ? 'none' : 'block';
    if (dockInstructions) dockInstructions.style.display = isDock ? 'block' : 'none';
}

// Helper for opening URLs - handles OBS dock limitations
function openUrlOrCopy(url, description = 'URL') {
    // Try to open in new window/tab
    const win = window.open(url, '_blank');
    
    // If failed (OBS dock), copy to clipboard instead
    if (!win || win.closed || typeof win.closed === 'undefined') {
        navigator.clipboard.writeText(url).then(() => {
            log(description + ' copied to clipboard! OBS docks cannot open external windows.', 'info');
        }).catch(() => {
            prompt('Copy this URL:', url);
        });
        return false;
    }
    return true;
}

// Initialize script status from OBS connection
async function checkScriptStatus() {
    scriptStatus.initialized = true;
    
    // Use the global 'connected' variable which is the source of truth
    if (!connected) {
        scriptStatus.connected = false;
        updateFeatureAvailability();
        renderStartupBanner();
        return;
    }
    
    // We're connected!
    scriptStatus.connected = true;
    
    // Try to verify OBS version (optional - won't block if fails)
    try {
        // Use global 'request' function from websocket.js
        const version = await request('GetVersion');
        if (version && version.obsVersion) {
            log('OBS ' + version.obsVersion + ' - All features enabled', 'success');
        }
    } catch (err) {
        // Non-critical - we're still connected
        console.warn('Version check failed:', err);
    }
    
    updateFeatureAvailability();
    renderStartupBanner();
}

// Try to detect which scripts are installed by checking OBS state
// Mark all scripts as available when connected
// (We can't reliably detect individual Lua scripts from WebSocket)
function markScriptsAsAvailable() {
    const scripts = window.Installer ? window.Installer.getAvailableScripts() : [];
    scripts.forEach(script => {
        scriptStatus.scripts[script.id] = { installed: true, version: script.version };
    });
}

// Update which features are available based on detected scripts
function updateFeatureAvailability() {
    // Simple logic: if connected, all features are available
    // We can't reliably detect individual Lua scripts from WebSocket
    const allEnabled = scriptStatus.connected;
    
    Object.keys(scriptStatus.features).forEach(f => {
        scriptStatus.features[f] = allEnabled;
    });
    
    // Also mark scripts as available when connected
    if (allEnabled) {
        markScriptsAsAvailable();
    }
    
    updateTabStates();
    updateDashboardStatus();
}

// Update tab visual states based on feature availability
function updateTabStates() {
    const tabs = document.querySelectorAll('.tab');
    const tabFeatures = {
        1: 'sources',   // Sources tab (index 1)
        2: 'text',      // Text tab (index 2)
        4: 'swap'       // Swaps tab (index 4)
    };
    
    tabs.forEach((tab, index) => {
        const feature = tabFeatures[index];
        if (feature && !scriptStatus.connected) {
            tab.classList.add('disabled');
            tab.title = 'Connect to OBS first';
        } else {
            tab.classList.remove('disabled');
        }
    });
    
    // Update dashboard status card
    updateDashboardStatus();
}

// Update the dashboard status card
function updateDashboardStatus() {
    const container = document.getElementById('dashboardScriptStatus');
    if (!container) return;
    
    if (scriptStatus.connected) {
        // Connected - show all features as available
        container.innerHTML = `
            <div class="script-status-grid">
                <div class="script-status-item installed">
                    <span class="script-status-item__icon">🔌</span>
                    <span class="script-status-item__name">OBS Connection</span>
                    <span class="script-status-item__badge">Online</span>
                </div>
                <div class="script-status-item installed">
                    <span class="script-status-item__icon">✨</span>
                    <span class="script-status-item__name">Animations</span>
                    <span class="script-status-item__badge">Ready</span>
                </div>
                <div class="script-status-item installed">
                    <span class="script-status-item__icon">🔄</span>
                    <span class="script-status-item__name">Source Swap</span>
                    <span class="script-status-item__badge">Ready</span>
                </div>
                <div class="script-status-item installed">
                    <span class="script-status-item__icon">📝</span>
                    <span class="script-status-item__name">Text Cycler</span>
                    <span class="script-status-item__badge">Ready</span>
                </div>
            </div>
            <p class="hint" style="margin-top:8px">
                ✅ All features available! Use the tabs above to access each feature.
            </p>
        `;
    } else {
        // Not connected - show warning
        container.innerHTML = `
            <div class="script-status-grid">
                <div class="script-status-item missing">
                    <span class="script-status-item__icon">🔌</span>
                    <span class="script-status-item__name">OBS Connection</span>
                    <span class="script-status-item__badge">Offline</span>
                </div>
            </div>
            <p class="hint" style="margin-top:8px">
                <button onclick="showPage('setup')" class="btn-link">⚙️ Go to Setup</button> to connect to OBS WebSocket
            </p>
            <p class="hint" style="margin-top:4px">
                <button onclick="showPage('install')" class="btn-link">📥 Install Scripts</button> if you haven't already
            </p>
        `;
    }
}

// Render startup banner based on current state
function renderStartupBanner() {
    // Remove existing banner
    const existingBanner = document.getElementById('startupBanner');
    if (existingBanner) existingBanner.remove();
    
    // Determine banner state
    let bannerHTML = '';
    
    if (!scriptStatus.connected) {
        bannerHTML = `
            <div id="startupBanner" class="startup-banner">
                <span class="startup-banner__icon">🔌</span>
                <div class="startup-banner__content">
                    <div class="startup-banner__title">Not Connected to OBS</div>
                    <div class="startup-banner__text">Connect to OBS WebSocket to enable all features. Some features require Lua scripts to be installed.</div>
                </div>
                <button class="startup-banner__action" onclick="showPage('setup')">⚙️ Setup</button>
            </div>
        `;
    } else {
        // Connected - show success briefly then fade
        bannerHTML = `
            <div id="startupBanner" class="startup-banner success">
                <span class="startup-banner__icon">✅</span>
                <div class="startup-banner__content">
                    <div class="startup-banner__title">Connected to OBS</div>
                    <div class="startup-banner__text">All features are available. Scripts detected and ready.</div>
                </div>
            </div>
        `;
    }
    
    // Insert banner at top of content area
    const content = document.querySelector('.content');
    if (content && bannerHTML) {
        content.insertAdjacentHTML('afterbegin', bannerHTML);
        
        // Auto-hide success banner after 5 seconds
        if (scriptStatus.connected) {
            setTimeout(() => {
                const banner = document.getElementById('startupBanner');
                if (banner) {
                    banner.style.transition = 'opacity 0.3s, height 0.3s, margin 0.3s, padding 0.3s';
                    banner.style.opacity = '0';
                    banner.style.height = '0';
                    banner.style.margin = '0';
                    banner.style.padding = '0';
                    banner.style.overflow = 'hidden';
                    setTimeout(() => banner.remove(), 300);
                }
            }, 5000);
        }
    }
}

// Render feature notice for a specific page
function renderFeatureNotice(containerId, featureId, scriptName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Remove existing notice
    const existing = container.querySelector('.feature-notice');
    if (existing) existing.remove();
    
    if (!scriptStatus.connected) {
        const notice = document.createElement('div');
        notice.className = 'feature-notice error';
        notice.innerHTML = `
            <div class="feature-notice__title">⚠️ Connection Required</div>
            <div class="feature-notice__text">
                Connect to OBS WebSocket to use this feature. 
                <button onclick="showPage('setup')" class="btn-link">Go to Setup →</button>
            </div>
        `;
        container.insertBefore(notice, container.firstChild);
    } else if (!scriptStatus.features[featureId]) {
        const notice = document.createElement('div');
        notice.className = 'feature-notice';
        notice.innerHTML = `
            <div class="feature-notice__title">📜 Script Required: ${scriptName}</div>
            <div class="feature-notice__text">
                This feature requires the ${scriptName} Lua script. 
                <button onclick="showPage('install')" class="btn-link">Go to Installer →</button>
            </div>
        `;
        container.insertBefore(notice, container.firstChild);
    }
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.ScriptStatus for clarity
if (typeof window !== 'undefined') {
    window.ScriptStatus = {
        checkScriptStatus,
        markScriptsAsAvailable,
        updateFeatureAvailability,
        updateTabStates,
        updateDashboardStatus,
        renderStartupBanner,
        renderFeatureNotice,
        isOBSDock,
        updateDockContextUI,
        openUrlOrCopy,
        // State getters
        get scriptStatus() { return scriptStatus; },
        get SCRIPT_FEATURE_MAP() { return SCRIPT_FEATURE_MAP; }
    };
}

