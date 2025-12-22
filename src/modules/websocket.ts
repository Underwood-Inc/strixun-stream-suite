/**
 * Strixun Stream Suite - WebSocket/OBS Connection Module
 * 
 * Handles OBS WebSocket connection, authentication, credential encryption,
 * message handling, and connection state management.
 * 
 * @version 2.0.0 (TypeScript)
 */

import { storage } from './storage';
import { connected, currentScene, sources, textSources } from '../stores/connection';
import { get } from 'svelte/store';
import type { Source } from '../types';

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

// ============ Secure Credential Storage (AES-GCM) ============
let encryptionKey: CryptoKey | null = null; // Derived from PIN, kept in memory only

/**
 * Derive encryption key from PIN
 */
async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt password with PIN
 */
async function encryptPassword(password: string, pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(password)
  );
  
  // Combine salt + iv + encrypted data and encode as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt password with PIN
 */
async function decryptPassword(encryptedData: string, pin: string): Promise<string | null> {
  try {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    
    const key = await deriveKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return null; // Wrong PIN or corrupted data
  }
}

/**
 * Save credentials to storage
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
    storage.setRaw('obs_host', host);
    storage.setRaw('obs_port', port);
    
    if (password) {
      // Check if crypto is available
      if (!crypto || !crypto.subtle) {
        log('ERROR: Encryption not available (file:// mode). Use localhost or HTTPS.', 'error');
        return;
      }
      
      // Get or create PIN for encryption
      let pin = sessionStorage.getItem('obs_pin');
      if (!pin) {
        pin = prompt('Create a PIN to encrypt your password (4+ characters):');
        if (!pin || pin.length < 4) {
          log('PIN must be 4+ characters. Password not saved.', 'error');
          storage.remove('obs_pw');
          return;
        }
        sessionStorage.setItem('obs_pin', pin); // Keep in session only
      }
      
      try {
        const encrypted = await encryptPassword(password, pin);
        storage.setRaw('obs_pw', encrypted);
        storage.setRaw('obs_pw_encrypted', 'true');
        log('Credentials saved securely', 'success');
      } catch (e: any) {
        log('Encryption failed: ' + e.message, 'error');
        storage.remove('obs_pw');
        storage.remove('obs_pw_encrypted');
      }
    } else {
      storage.remove('obs_pw');
      storage.remove('obs_pw_encrypted');
    }
    storage.setRaw('obs_remember', 'true');
  } else {
    storage.remove('obs_host');
    storage.remove('obs_port');
    storage.remove('obs_pw');
    storage.remove('obs_pw_encrypted');
    storage.remove('obs_remember');
    sessionStorage.removeItem('obs_pin');
  }
}

/**
 * Load credentials from storage
 */
export async function loadCredentials(): Promise<boolean> {
  const remembered = storage.getRaw('obs_remember') === 'true';
  const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
  if (rememberEl) {
    rememberEl.checked = remembered;
  }
  
  if (remembered) {
    const host = storage.getRaw('obs_host');
    const port = storage.getRaw('obs_port');
    const encryptedPw = storage.getRaw('obs_pw');
    const isEncrypted = storage.getRaw('obs_pw_encrypted') === 'true';
    
    const hostEl = document.getElementById('host') as HTMLInputElement;
    const portEl = document.getElementById('port') as HTMLInputElement;
    if (host && hostEl) hostEl.value = String(host);
    if (port && portEl) portEl.value = String(port);
    
    if (encryptedPw && isEncrypted) {
      // Check if crypto is available
      if (!crypto || !crypto.subtle) {
        log('ERROR: Decryption not available (file:// mode). Clear credentials.', 'error');
        updateSecurityWarning();
        return false;
      }
      
      // Need PIN to decrypt
      let pin = sessionStorage.getItem('obs_pin');
      if (!pin) {
        pin = prompt('Enter PIN to unlock saved password:');
        if (!pin) {
          log('PIN required to use saved password', 'error');
          updateSecurityWarning();
          return false;
        }
      }
      
      try {
        const password = await decryptPassword(String(encryptedPw), pin);
        if (password) {
          const passwordEl = document.getElementById('password') as HTMLInputElement;
          if (passwordEl) {
            passwordEl.value = password;
          }
          sessionStorage.setItem('obs_pin', pin); // Remember for session
          updateSecurityWarning();
          return true;
        } else {
          log('Wrong PIN or corrupted data', 'error');
          sessionStorage.removeItem('obs_pin');
          updateSecurityWarning();
          return false;
        }
      } catch (e: any) {
        log('Decryption failed: ' + e.message, 'error');
        sessionStorage.removeItem('obs_pin');
        updateSecurityWarning();
        return false;
      }
    }
    
    updateSecurityWarning();
    return true; // Has host/port at least
  }
  return false;
}

/**
 * Clear saved credentials
 */
export function clearSavedCredentials(): void {
  storage.remove('obs_host');
  storage.remove('obs_port');
  storage.remove('obs_pw');
  storage.remove('obs_pw_encrypted');
  storage.remove('obs_remember');
  sessionStorage.removeItem('obs_pin');
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
  const isEncrypted = storage.getRaw('obs_pw_encrypted') === 'true';
  
  if (remember && pw) {
    if (isEncrypted) {
      warn.textContent = '🔐 Password encrypted with AES-256-GCM';
      (warn as HTMLElement).style.color = 'var(--success)';
    } else {
      warn.textContent = '🔒 Password will be encrypted with your PIN';
      (warn as HTMLElement).style.color = 'var(--accent)';
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
 * Connect to OBS WebSocket
 */
export function connect(): void {
  const hostEl = document.getElementById('host') as HTMLInputElement;
  const portEl = document.getElementById('port') as HTMLInputElement;
  const passwordEl = document.getElementById('password') as HTMLInputElement;
  
  const host = hostEl?.value || 'localhost';
  const port = portEl?.value || '4455';
  const password = passwordEl?.value || '';
  
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
      console.log('WebSocket error:', e);
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
      console.log('WebSocket closed:', e.code, e.reason);
      
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
      console.log('[RAW CustomEvent]', JSON.stringify(data.d, null, 2));
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
    console.log('[OBS Event]', event.eventType, event.eventData);
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
  
  // Handle custom storage sync events (Vendor events)
  if (event.eventType === 'CustomEvent') {
    const customData = event.eventData?.eventData;
    console.log('[Storage Sync] CustomEvent received:', {
      type: customData?.type,
      source: customData?.source || customData?.clientId,
      hasData: !!customData?.data,
      timestamp: customData?.timestamp
    });
    
    // Delegate storage sync events to StorageSync module
    // Use window.StorageSync to avoid circular dependency (initialized in bootstrap)
    if ((window as any).StorageSync && (customData?.type === 'strixun_storage_broadcast' || customData?.type === 'strixun_storage_request')) {
      (window as any).StorageSync.handleCustomEvent(customData);
    } else if (customData?.type === 'strixun_text_cycler_msg') {
      // Handle text cycler messages from remote control panel (same pattern as quick swaps)
      // Remote sends via WebSocket, OBS dock receives and handles locally
      const configId = customData.configId;
      const message = customData.message;
      const timestamp = customData.timestamp || Date.now();
      
      if (configId && message) {
        // OBS dock: forward to localStorage so browser source can receive it
        if (typeof (window as any).isOBSDock === 'function' && (window as any).isOBSDock()) {
          try {
            const messageData = {
              message: message,
              timestamp: timestamp
            };
            localStorage.setItem('text_cycler_msg_' + configId, JSON.stringify(messageData));
            console.log('[Text Cycler] OBS dock forwarded to localStorage:', configId, message.type);
          } catch (e) {
            console.warn('[Text Cycler] Failed to forward:', e);
          }
        }
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
  } else {
    console.log(`[${type}] ${msg}`);
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

