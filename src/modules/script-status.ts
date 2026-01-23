/**
 * Strixun Stream Suite - Script Status/Feature Detection Module
 * 
 * Handles script status tracking, feature availability detection,
 * and UI updates based on connection and script availability.
 * 
 * @version 2.0.0 (TypeScript)
 */

import { connected } from '../stores/connection';
import { request } from './websocket';
import { get } from 'svelte/store';
import { navigateTo } from '../stores/navigation';
import { showWarning, showSuccess, dismissToast } from '../stores/toast-queue';

// ============ Types ============
interface ScriptInfo {
  installed: boolean;
  version: string | null;
}

interface ScriptStatus {
  initialized: boolean;
  connected: boolean;
  scripts: Record<string, ScriptInfo>;
  features: {
    sources: boolean;
    swap: boolean;
    text: boolean;
    animations: boolean;
  };
}

interface ScriptFeatureMap {
  [key: string]: string[];
}

interface AvailableScript {
  id: string;
  version?: string;
  [key: string]: any;
}

// ============ State ============
const scriptStatus: ScriptStatus = {
  initialized: false,
  connected: false, // This is now synced with the Svelte store
  scripts: {},
  features: {
    sources: false,
    swap: false,
    text: false,
    animations: false
  }
};

// Track the current connection toast ID to dismiss it when state changes
let currentConnectionToastId: string | null = null;

// Sync scriptStatus.connected with Svelte store and update UI reactively
connected.subscribe((isConnected) => {
  scriptStatus.connected = isConnected;
  // Dismiss previous connection toast if it exists
  if (currentConnectionToastId) {
    dismissToast(currentConnectionToastId);
    currentConnectionToastId = null;
  }
  // Show new toast when connection state changes
  renderStartupBanner();
  updateDashboardStatus();
  updateTabStates();
});

// Map scripts to features they enable
export const SCRIPT_FEATURE_MAP: ScriptFeatureMap = {
  'source_animations': ['sources', 'animations'],
  'source_swap': ['swap'],
  'text_cycler': ['text'],
  'quick_controls': [],  // Utility script, no UI features
  'script_manager': []   // Meta script, no UI features
};

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
 * Detect if running in OBS dock (embedded CEF browser)
 */
export function isOBSDock(): boolean {
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

/**
 * Update UI based on dock context
 */
export function updateDockContextUI(): void {
  const isDock = isOBSDock();
  const downloadBtn = document.getElementById('downloadScriptBtn') as HTMLElement | null;
  const dockWarning = document.getElementById('dockDownloadWarning') as HTMLElement | null;
  const browserInstructions = document.getElementById('browserInstructions') as HTMLElement | null;
  const dockInstructions = document.getElementById('dockInstructions') as HTMLElement | null;
  
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

/**
 * Helper for opening URLs - handles OBS dock limitations
 */
export function openUrlOrCopy(url: string, description: string = 'URL'): boolean {
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

/**
 * Initialize script status from OBS connection
 */
export async function checkScriptStatus(): Promise<void> {
  scriptStatus.initialized = true;
  
  // Use the Svelte store which is the source of truth
  const isConnected = get(connected);
  if (!isConnected) {
    scriptStatus.connected = false;
    updateFeatureAvailability();
    renderStartupBanner();
    return;
  }
  
  // We're connected!
  scriptStatus.connected = true;
  
  // Try to verify OBS version (optional - won't block if fails)
  try {
    const version = await request('GetVersion');
    const versionData = version as { obsVersion?: string } | null;
    if (versionData && versionData.obsVersion) {
      log('OBS ' + versionData.obsVersion + ' - All features enabled', 'success');
    }
  } catch (err) {
    // Non-critical - we're still connected
    console.warn('Version check failed:', err);
  }
  
  updateFeatureAvailability();
  renderStartupBanner();
}

/**
 * Try to detect which scripts are installed by checking OBS state
 * Mark all scripts as available when connected
 */
export function markScriptsAsAvailable(): void {
  const scriptDownloader = (window as any).ScriptDownloader;
  const scripts = scriptDownloader?.getAvailableScripts ? scriptDownloader.getAvailableScripts() as AvailableScript[] : [];
  scripts.forEach(script => {
    scriptStatus.scripts[script.id] = { installed: true, version: script.version || null };
  });
}

/**
 * Update which features are available based on detected scripts
 */
export function updateFeatureAvailability(): void {
  // Simple logic: if connected, all features are available
  // We can't reliably detect individual Lua scripts from WebSocket
  // Use Svelte store directly
  const allEnabled = get(connected);
  
  Object.keys(scriptStatus.features).forEach(f => {
    (scriptStatus.features as any)[f] = allEnabled;
  });
  
  // Also mark scripts as available when connected
  if (allEnabled) {
    markScriptsAsAvailable();
  }
  
  updateTabStates();
  updateDashboardStatus();
}

/**
 * Update tab visual states based on feature availability
 * NOTE: Tab states are now handled reactively by Navigation.svelte component
 * This function only updates dashboard status
 */
export function updateTabStates(): void {
  // Tab states are handled reactively by Navigation.svelte based on $connected store
  // No DOM manipulation needed - Svelte handles this reactively
  
  // Update dashboard status card
  updateDashboardStatus();
}

/**
 * Update the dashboard status card
 */
export function updateDashboardStatus(): void {
  const container = document.getElementById('dashboardScriptStatus');
  if (!container) return;
  
  // Use Svelte store directly
  const isConnected = get(connected);
  if (isConnected) {
    // Connected - show all features as available
    container.innerHTML = `
      <div class="script-status-grid">
        <div class="script-status-item installed">
          <span class="script-status-item__icon"></span>
          <span class="script-status-item__name">OBS Connection</span>
          <span class="script-status-item__badge">Online</span>
        </div>
        <div class="script-status-item installed">
          <span class="script-status-item__icon">→</span>
          <span class="script-status-item__name">Animations</span>
          <span class="script-status-item__badge">Ready</span>
        </div>
        <div class="script-status-item installed">
          <span class="script-status-item__icon"> ★ </span>
          <span class="script-status-item__name">Source Swap</span>
          <span class="script-status-item__badge">Ready</span>
        </div>
        <div class="script-status-item installed">
          <span class="script-status-item__icon"> ★ </span>
          <span class="script-status-item__name">Text Cycler</span>
          <span class="script-status-item__badge">Ready</span>
        </div>
      </div>
      <p class="hint" style="margin-top:8px">
        ✓ All features available! Use the tabs above to access each feature.
      </p>
    `;
  } else {
    // Not connected - show warning
    container.innerHTML = `
      <div class="script-status-grid">
        <div class="script-status-item missing">
          <span class="script-status-item__icon"></span>
          <span class="script-status-item__name">OBS Connection</span>
          <span class="script-status-item__badge">Offline</span>
        </div>
      </div>
      <p class="hint" style="margin-top:8px">
        <button onclick="window.showPage?.('setup')" class="btn-link">≡ Go to Setup</button> to connect to OBS WebSocket
      </p>
      <p class="hint" style="margin-top:4px">
        <button onclick="window.showPage?.('scripts')" class="btn-link">📥 Download Scripts</button> to get the latest versions
      </p>
    `;
  }
}

/**
 * Render startup banner based on current state
 * Now uses toast notifications instead of DOM banner
 * NOTE: Disconnected warning removed - UI elements already show disabled states
 */
export function renderStartupBanner(): void {
  // Determine banner state - use Svelte store directly
  const isConnected = get(connected);
  
  // Only show success toast when connected
  // Disconnected warning removed - UI already shows disabled states
  if (isConnected) {
    // Connected - show success toast (auto-dismiss after 5 seconds)
    currentConnectionToastId = showSuccess(
      'All features are available. Scripts detected and ready.',
      {
        title: 'Connected to OBS',
        duration: 5000,
        persistent: false
      }
    );
  }
}

/**
 * Render feature notice for a specific page
 */
export function renderFeatureNotice(containerId: string, featureId: string, scriptName: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // Remove existing notice
  const existing = container.querySelector('.feature-notice');
  if (existing) existing.remove();
  
  // Use Svelte store directly
  const isConnected = get(connected);
  if (!isConnected) {
    const notice = document.createElement('div');
    notice.className = 'feature-notice error';
    notice.innerHTML = `
      <div class="feature-notice__title">⚠ Connection Required</div>
      <div class="feature-notice__text">
        Connect to OBS WebSocket to use this feature. 
        <button onclick="window.showPage?.('setup')" class="btn-link">Go to Setup </button>
      </div>
    `;
    container.insertBefore(notice, container.firstChild);
  } else if (!scriptStatus.features[featureId as keyof typeof scriptStatus.features]) {
    const notice = document.createElement('div');
    notice.className = 'feature-notice';
    notice.innerHTML = `
      <div class="feature-notice__title"> Script Required: ${scriptName}</div>
      <div class="feature-notice__text">
        This feature requires the ${scriptName} Lua script. 
        <button onclick="window.showPage?.('scripts')" class="btn-link">Download Scripts 📥</button>
      </div>
    `;
    container.insertBefore(notice, container.firstChild);
  }
}

// ============ Exports ============
export const ScriptStatus = {
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

// Expose to window for legacy compatibility
if (typeof window !== 'undefined') {
  (window as any).ScriptStatus = ScriptStatus;
  (window as any).isOBSDock = isOBSDock;
  (window as any).openUrlOrCopy = openUrlOrCopy;
}

