/**
 * Strixun Stream Suite - WebSocket/OBS Connection Module
 * 
 * Handles OBS WebSocket connection, authentication, credential encryption,
 * message handling, and connection state management.
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage.js';
import { connected, currentScene, sources, textSources } from '../stores/connection.js';
import { get } from 'svelte/store';
import { authenticatedFetch, isAuthenticated } from '../stores/auth.js';
import { initOBSStorage, handleOBSStorageResponse, isInOBS } from './obs-storage.js';

// ============ Types ============
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: string) => void;
}

interface OBSMessage {
  op: number;
  d?: any;
}

interface OBSEvent {
  eventType: string;
  eventData?: any;
}

// ============ State ============
let ws: WebSocket | null = null;
let msgId = 1;
let pendingRequests: Record<string, PendingRequest> = {};
let aspectMode = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;
// Password for programmatic connection (display routes without DOM elements)
let storedPassword: string = '';

// ============ Cloud Credential Storage ============
// OBS credentials are stored in the cloud, encrypted with the user's auth token
// Credentials expire when the auth token expires (7 hours maximum)

/**
 * Save credentials to cloud storage
 * Requires authentication - credentials expire when auth token expires (7 hours max)
 */
export async function saveCredentials(): Promise<void> {
  const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
  const hostEl = document.getElementById('host') as HTMLInputElement;
  const portEl = document.getElementById('port') as HTMLInputElement;
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  
  const remember = rememberEl?.checked || false;
  const host = hostEl?.value || '';
  const port = portEl?.value || '';
  const password = passwordEl?.value || '';
  
  if (remember) {
    // Always save host/port to storage (uses OBS storage when in OBS)
    storage.setRaw('obs_host', host);
    storage.setRaw('obs_port', port);
    storage.setRaw('obs_remember', 'true');
    
    // CRITICAL: When in OBS, also save password to OBS storage for persistence
    // OBS storage is isolated to OBS and persists across restarts
    if (password && isInOBS()) {
      storage.setRaw('obs_password', password);
      log('Credentials saved to OBS storage', 'success');
    }
    
    // Save password to cloud if authenticated (for cross-device sync)
    if (password && get(isAuthenticated)) {
      try {
        await authenticatedFetch('/obs-credentials/save', {
          method: 'POST',
          body: JSON.stringify({
            host,
            port,
            password
          })
        });
        log('Credentials saved to cloud (expires in 7 hours)', 'success');
      } catch (e: any) {
        if (e.message === 'Not authenticated') {
          // Don't warn if already saved to OBS storage
          if (!isInOBS()) {
            log('Sign in to save password securely in the cloud', 'warning');
          }
        } else {
          log('Failed to save credentials to cloud: ' + e.message, 'error');
        }
      }
    } else if (password && !isInOBS()) {
      log('Sign in to save password securely in the cloud', 'warning');
    }
  } else {
    // Clear storage (uses OBS storage when in OBS)
    storage.remove('obs_host');
    storage.remove('obs_port');
    storage.remove('obs_remember');
    storage.remove('obs_password'); // Also clear password from OBS storage
    
    // Clear cloud storage if authenticated
    if (get(isAuthenticated)) {
      try {
        await authenticatedFetch('/obs-credentials/delete', {
          method: 'DELETE'
        });
      } catch (e) {
        // Ignore errors when clearing
      }
    }
  }
}

/**
 * Load credentials from cloud storage
 * Requires authentication - credentials expire when auth token expires (7 hours max)
 */
export async function loadCredentials(): Promise<boolean> {
  const remembered = storage.getRaw('obs_remember') === 'true';
  const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
  if (rememberEl) {
    rememberEl.checked = remembered;
  }
  
  if (remembered) {
    // Load host/port from storage (uses OBS storage when in OBS)
    const host = storage.getRaw('obs_host');
    const port = storage.getRaw('obs_port');
    
    const hostEl = document.getElementById('host') as HTMLInputElement;
    const portEl = document.getElementById('port') as HTMLInputElement;
    if (host && hostEl) hostEl.value = String(host);
    if (port && portEl) portEl.value = String(port);
    
    // CRITICAL: When in OBS, load password from OBS storage first
    // OBS storage persists across OBS restarts and is isolated to OBS
    if (isInOBS()) {
      const obsPassword = storage.getRaw('obs_password') as string | null;
      if (obsPassword) {
        storedPassword = obsPassword;
        const passwordEl = document.getElementById('password') as HTMLInputElement;
        if (passwordEl) {
          passwordEl.value = obsPassword;
        }
        updateSecurityWarning();
        log('Credentials loaded from OBS storage', 'info');
        return true;
      }
    }
    
    // Load password from cloud if authenticated (fallback, or for non-OBS environments)
    if (get(isAuthenticated)) {
      try {
        // Check if API URL is configured before attempting fetch
        const apiUrl = typeof window !== 'undefined' && (window as any).getWorkerApiUrl 
          ? (window as any).getWorkerApiUrl() 
          : null;
        // Skip only if no API URL or contains placeholder markers
        if (!apiUrl || apiUrl.includes('%%') || apiUrl.includes('{{')) {
          // API not configured or using placeholder - skip cloud credential load
          return true; // Has host/port at least
        }
        
        const response = await authenticatedFetch('/obs-credentials/load');
        if (response.ok) {
          const data = await response.json();
          if (data.password) {
            // Store for programmatic connection (display routes without DOM elements)
            storedPassword = data.password;
            
            const passwordEl = document.getElementById('password') as HTMLInputElement;
            if (passwordEl) {
              passwordEl.value = data.password;
            }
            updateSecurityWarning();
            return true;
          }
        } else if (response.status === 404) {
          // 404 is expected when no credentials are saved - not an error
          // Just silently continue without password (host/port are still loaded from local storage)
        } else {
          // Other errors (500, etc.) - log but don't fail
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          log(`Failed to load credentials from cloud: ${errorData.error || 'Unknown error'}`, 'warning');
        }
      } catch (e: any) {
        // Suppress expected errors for local development
        const errorMsg = e.message || String(e);
        const isExpectedError = 
          errorMsg === 'Not authenticated' ||
          errorMsg.includes('404') ||
          errorMsg.includes('API URL not configured') ||
          errorMsg.includes('ERR_NAME_NOT_RESOLVED') ||
          errorMsg.includes('Failed to fetch');
        
        if (!isExpectedError) {
          log('Failed to load credentials from cloud: ' + errorMsg, 'error');
        }
        // Silently continue - local storage credentials are still available
      }
    }
    
    updateSecurityWarning();
    return true; // Has host/port at least
  }
  return false;
}

/**
 * Clear saved credentials (local, OBS, and cloud)
 */
export async function clearSavedCredentials(): Promise<void> {
  // Clear storage (uses OBS storage when in OBS)
  storage.remove('obs_host');
  storage.remove('obs_port');
  storage.remove('obs_remember');
  storage.remove('obs_password'); // Also clear password from OBS storage
  
  // Clear cloud storage if authenticated
  if (get(isAuthenticated)) {
    try {
      await authenticatedFetch('/obs-credentials/delete', {
        method: 'DELETE'
      });
    } catch (e) {
      // Ignore errors when clearing
    }
  }
  
  const hostEl = document.getElementById('host') as HTMLInputElement;
  const portEl = document.getElementById('port') as HTMLInputElement;
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
  if (hostEl) hostEl.value = 'localhost';
  if (portEl) portEl.value = '4455';
  if (passwordEl) passwordEl.value = '';
  if (rememberEl) rememberEl.checked = false;
  updateSecurityWarning();
  log('Saved credentials cleared', 'info');
}

/**
 * Update security warning display
 */
export function updateSecurityWarning(): void {
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
  const warn = document.getElementById('securityWarning');
  
  if (!passwordEl || !rememberEl || !warn) return;
  
  const pw = passwordEl.value;
  const remember = rememberEl.checked;
  const authenticated = get(isAuthenticated);
  
  if (remember && pw) {
    if (authenticated) {
      warn.textContent = ' ★ Password will be saved securely in the cloud (expires in 7 hours)';
      (warn as HTMLElement).style.color = 'var(--success)';
    } else {
      warn.textContent = '⚠ Sign in to save password securely in the cloud';
      (warn as HTMLElement).style.color = 'var(--warning)';
    }
  } else {
    warn.textContent = '';
  }
}

// ============ Connection State UI ============

/**
 * Update connection state classes and button states
 */
export function updateConnectionState(): void {
  const app = document.querySelector('.app');
  if (app) {
    if (get(connected)) {
      app.classList.remove('disconnected');
    } else {
      app.classList.add('disconnected');
    }
  }
  
  // Disable action buttons when disconnected
  document.querySelectorAll('.source-btn, #startCycleBtn').forEach(btn => {
    (btn as HTMLButtonElement).disabled = !get(connected);
  });
}

/**
 * Update connection UI elements
 */
export function updateConnectionUI(): void {
  const dot = document.getElementById('statusDot');
  const btn = document.getElementById('connectBtn');
  const headerBtn = document.getElementById('connectHeaderBtn');
  
  const isConnected = get(connected);
  
  if (dot) {
    if (isConnected) {
      dot.className = 'status-dot connected';
    } else {
      dot.className = 'status-dot';
    }
  }
  
  if (btn) {
    if (isConnected) {
      btn.textContent = 'Disconnect';
      btn.className = 'btn-danger btn-block';
    } else {
      btn.textContent = 'Connect';
      btn.className = 'btn-primary btn-block';
    }
  }
  
  if (headerBtn) {
    if (isConnected) {
      headerBtn.textContent = 'Connected';
      headerBtn.className = 'btn-success';
    } else {
      headerBtn.textContent = 'Connect';
      headerBtn.className = '';
    }
  }
}

// ============ WebSocket Connection ============

/**
 * Toggle connection state
 */
export function toggleConnection(): void {
  get(connected) ? disconnect() : connect();
}

/**
 * Connect to OBS WebSocket programmatically (without DOM elements)
 * Used by display routes that don't have the connection form
 */
export function connectProgrammatic(host: string = 'localhost', port: string = '4455', password: string = ''): void {
  console.log('[WebSocket] connectProgrammatic called:', { host, port, hasPassword: !!password });
  
  try {
    ws = new WebSocket(`ws://${host}:${port}`);
    ws.onopen = () => {
      console.log('[WebSocket] Socket open, authenticating...');
      reconnectAttempts = 0;
    };
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data), password);
    ws.onerror = () => { 
      console.error('[WebSocket] Connection error');
    };
    ws.onclose = (e) => { 
      const wasConnected = get(connected);
      connected.set(false);
      console.log('[WebSocket] Disconnected:', e.code);
      
      // Auto-reconnect on abnormal close
      if (wasConnected && e.code !== 1000) {
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          console.log(`[WebSocket] Reconnecting (${reconnectAttempts}/${MAX_RECONNECT})...`);
          setTimeout(() => connectProgrammatic(host, port, password), 3000);
        }
      }
    };
  } catch (e: any) {
    console.error('[WebSocket] Connect failed:', e.message);
  }
}

/**
 * Check if we have a stored password for programmatic connection
 */
export function hasStoredPassword(): boolean {
  return !!storedPassword;
}

/**
 * Connect to OBS WebSocket
 * @param credentials Optional credentials for programmatic connection (display routes)
 */
export function connect(credentials?: { host?: string; port?: string; password?: string }): void {
  const hostEl = document.getElementById('host') as HTMLInputElement;
  const portEl = document.getElementById('port') as HTMLInputElement;
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  
  const host = credentials?.host || hostEl?.value || (storage.getRaw('obs_host') as string) || 'localhost';
  const port = credentials?.port || portEl?.value || (storage.getRaw('obs_port') as string) || '4455';
  const password = credentials?.password || passwordEl?.value || storedPassword || '';
  
  // Store for future reconnects
  if (password) {
    storedPassword = password;
  }
  
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    statusDot.className = 'status-dot connecting';
  }
  log('Connecting...', 'info');
  
  try {
    ws = new WebSocket(`ws://${host}:${port}`);
    ws.onopen = () => {
      log('Socket open, authenticating...');
      reconnectAttempts = 0;
    };
    ws.onmessage = (e) => handleMessage(JSON.parse(e.data), password);
    ws.onerror = (e) => { 
      log('Connection error', 'error');
      // Error already logged via log() function
    };
    ws.onclose = (e) => { 
      const wasConnected = get(connected);
      connected.set(false);
      updateConnectionUI();
      updateConnectionState();
      
      // Reset script status on disconnect
      if (typeof (window as any).scriptStatus !== 'undefined') {
        (window as any).scriptStatus.connected = false;
      }
      if (typeof (window as any).updateFeatureAvailability === 'function') {
        (window as any).updateFeatureAvailability();
      }
      if (typeof (window as any).renderStartupBanner === 'function') {
        (window as any).renderStartupBanner();
      }
      
      // Log close reason for debugging
      const reason = e.code === 1000 ? 'normal' : e.code === 1006 ? 'abnormal' : `code ${e.code}`;
      log(`Disconnected (${reason})`, wasConnected ? 'error' : 'info');
      // Close reason already logged via log() function
      
      // Only auto-reconnect on abnormal close, not if user disconnected
      if (wasConnected && e.code !== 1000 && storage.getRaw('obs_remember') === 'true') {
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          log(`Reconnecting (${reconnectAttempts}/${MAX_RECONNECT})...`, 'info');
          setTimeout(connect, 3000); // Longer delay
        }
      }
    };
  } catch (e: any) {
    log('Failed: ' + e.message, 'error');
    updateConnectionState();
  }
}

/**
 * Disconnect from OBS WebSocket
 */
export function disconnect(): void {
  reconnectAttempts = MAX_RECONNECT; // Prevent auto-reconnect
  if (ws) ws.close();
  connected.set(false);
  updateConnectionUI();
  updateConnectionState();
  
  // Update banner when disconnected
  if (typeof (window as any).ScriptStatus?.renderStartupBanner === 'function') {
    (window as any).ScriptStatus.renderStartupBanner();
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(data: OBSMessage, password: string): Promise<void> {
  // EventSubscription bitmask: All standard events (2047) ensures we get Vendors/CustomEvent (512)
  // This is critical for cross-client storage sync via BroadcastCustomEvent
  const EVENT_SUBSCRIPTIONS = (1 << 11) - 1; // 2047 = All standard events including Vendors
  
  if (data.op === 0) { // Hello
    const auth = data.d?.authentication;
    if (auth && password) {
      const secret = await sha256(password + auth.salt);
      const authStr = await sha256(secret + auth.challenge);
      send({ op: 1, d: { rpcVersion: 1, authentication: authStr, eventSubscriptions: EVENT_SUBSCRIPTIONS } });
    } else if (!auth) {
      send({ op: 1, d: { rpcVersion: 1, eventSubscriptions: EVENT_SUBSCRIPTIONS } });
    } else {
      log('Password required', 'error');
      disconnect();
    }
  } else if (data.op === 2) { // Identified
    connected.set(true);
    updateConnectionUI();
    updateConnectionState();
    
    // CRITICAL: Initialize OBS storage when running inside OBS
    // This enables persistent storage using OBS WebSocket GetPersistentData/SetPersistentData
    if (isInOBS() && ws) {
      try {
        await initOBSStorage(ws);
        log('OBS storage initialized', 'success');
      } catch (e) {
        console.warn('[WebSocket] Failed to initialize OBS storage:', e);
      }
    }
    
    await saveCredentials(); // Save on successful connection
    log('Connected to OBS!', 'success');
    
    // Update banner when connected
    if (typeof (window as any).ScriptStatus?.renderStartupBanner === 'function') {
      (window as any).ScriptStatus.renderStartupBanner();
    }
    
    // Call refreshScenes if available (via Sources module)
    if (typeof (window as any).Sources?.refreshScenes === 'function') {
      (window as any).Sources.refreshScenes();
    }
    
    // Restore saved opacity settings
    if (typeof (window as any).restoreSavedOpacities === 'function') {
      setTimeout((window as any).restoreSavedOpacities, 800);
    }
    
    // Check script status after connection
    if (typeof (window as any).ScriptStatus?.checkScriptStatus === 'function') {
      setTimeout(() => (window as any).ScriptStatus.checkScriptStatus(), 500);
    }
    
    // Sync storage across connected clients
    if (typeof (window as any).requestStorageSync === 'function') {
      setTimeout((window as any).requestStorageSync, 1000);
    }
  } else if (data.op === 7) { // Response
    // First check if this is an OBS storage response
    if (handleOBSStorageResponse(data)) {
      return; // Handled by OBS storage
    }
    const req = pendingRequests[data.d?.requestId];
    if (req) {
      if (data.d?.requestStatus?.result) {
        req.resolve(data.d.responseData);
      } else {
        req.reject(data.d?.requestStatus?.comment || 'Request failed');
      }
      delete pendingRequests[data.d?.requestId];
    }
  } else if (data.op === 5) { // Event
    // Log ALL CustomEvents before filtering
    if (data.d?.eventType === 'CustomEvent') {
      // CustomEvent logging can be enabled via debug flag
    }
    handleEvent(data.d);
  }
}

/**
 * Handle OBS events
 */
function handleEvent(event: OBSEvent): void {
  // Debug: log all events to console (verbose mode)
  if (event.eventType !== 'SceneItemTransformChanged') { // Skip noisy events
    // Event logging can be enabled via debug flag
  }
  
  if (event.eventType === 'CurrentProgramSceneChanged') {
    const sceneName = event.eventData?.sceneName || '';
    currentScene.set(sceneName);
    
    const currentSceneEl = document.getElementById('currentScene');
    if (currentSceneEl) {
      currentSceneEl.textContent = sceneName;
    }
    
    if (typeof (window as any).refreshSources === 'function') {
      (window as any).refreshSources();
    }
    if (typeof (window as any).renderSavedLayouts === 'function') {
      (window as any).renderSavedLayouts(); // Refresh layouts for new scene
    }
  }
  
  // Handle custom events (BroadcastCustomEvent)
  if (event.eventType === 'CustomEvent') {
    // OBS puts BroadcastCustomEvent data directly in eventData
    const customData = event.eventData;
    
    // Delegate storage sync events to StorageSync module
    if ((window as any).StorageSync && (customData?.type === 'strixun_storage_broadcast' || customData?.type === 'strixun_storage_request')) {
      (window as any).StorageSync.handleCustomEvent(customData);
    } else if (customData?.type === 'strixun_text_cycler_msg') {
      // Handle text cycler messages
      const configId = customData.configId;
      const message = customData.message;
      const timestamp = customData.timestamp || Date.now();
      
      if (configId && message) {
        // Dispatch as a window event so TextCyclerDisplay can receive it
        window.dispatchEvent(new CustomEvent('strixun_text_cycler_msg', {
          detail: { configId, message, timestamp }
        }));
      }
    }
  }
}

/**
 * Send message to OBS WebSocket
 */
export function send(data: OBSMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Send request to OBS and wait for response
 */
export function request(type: string, data: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = 'req_' + (msgId++);
    pendingRequests[id] = { resolve, reject };
    send({ op: 6, d: { requestType: type, requestId: id, requestData: data } });
    setTimeout(() => {
      if (pendingRequests[id]) {
        delete pendingRequests[id];
        reject('Timeout');
      }
    }, 5000);
  });
}

/**
 * SHA-256 hash function
 */
async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * Log function (delegates to App.log if available)
 */
function log(msg: string, type: string = 'info'): void {
  if ((window as any).App?.log) {
    (window as any).App.log(msg, type);
  } else if ((window as any).addLogEntry) {
    const logType = (type === 'success' || type === 'error' || type === 'warning' || type === 'debug') 
      ? type as 'info' | 'success' | 'error' | 'warning' | 'debug'
      : 'info';
    (window as any).addLogEntry(msg, logType);
  }
}

// ============ Exports ============
// Export getters for state (for legacy code compatibility)
export function getWs(): WebSocket | null {
  return ws;
}

export function getMsgId(): number {
  return msgId;
}

// Expose to window for legacy modules that still need it
// Will be removed as we migrate more modules
if (typeof window !== 'undefined') {
  (window as any).ws = ws;
  (window as any).connected = false; // Will be synced via store
  (window as any).msgId = msgId;
  (window as any).currentScene = '';
  (window as any).sources = [];
  (window as any).textSources = [];
  
  // Sync store changes to window globals (temporary during migration)
  connected.subscribe(val => {
    (window as any).connected = val;
  });
  currentScene.subscribe(val => {
    (window as any).currentScene = val;
  });
  sources.subscribe(val => {
    (window as any).sources = val;
  });
  textSources.subscribe(val => {
    (window as any).textSources = val;
  });
  
  // Expose functions
  (window as any).connect = connect;
  (window as any).disconnect = disconnect;
  (window as any).toggleConnection = toggleConnection;
  (window as any).send = send;
  (window as any).request = request;
  (window as any).saveCredentials = saveCredentials;
  (window as any).loadCredentials = loadCredentials;
  (window as any).clearSavedCredentials = clearSavedCredentials;
  (window as any).updateSecurityWarning = updateSecurityWarning;
  (window as any).updateConnectionState = updateConnectionState;
  (window as any).updateConnectionUI = updateConnectionUI;
  
  // Update ws reference when it changes
  Object.defineProperty(window, 'ws', {
    get: () => ws,
    configurable: true
  });
  
  Object.defineProperty(window, 'msgId', {
    get: () => msgId,
    configurable: true
  });
}

