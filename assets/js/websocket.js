/**
 * Strixun Stream Suite - WebSocket/OBS Connection Module
 * 
 * Handles OBS WebSocket connection, authentication, credential encryption,
 * message handling, and connection state management.
 * 
 * @version 1.0.0
 */

// ============ State (Global - accessed by other modules) ============
let ws = null;
let connected = false;
let msgId = 1;
let pendingRequests = {};
let currentScene = '';
let sources = [];
let textSources = [];
let aspectMode = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;

// ============ Secure Credential Storage (AES-GCM) ============
let encryptionKey = null; // Derived from PIN, kept in memory only

async function deriveKey(pin, salt) {
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

async function encryptPassword(password, pin) {
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

async function decryptPassword(encryptedData, pin) {
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

async function saveCredentials() {
    const remember = document.getElementById('rememberCreds').checked;
    const host = document.getElementById('host').value;
    const port = document.getElementById('port').value;
    const password = document.getElementById('password').value;
    
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
            } catch (e) {
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

async function loadCredentials() {
    const remembered = storage.getRaw('obs_remember') === 'true';
    document.getElementById('rememberCreds').checked = remembered;
    
    if (remembered) {
        const host = storage.getRaw('obs_host');
        const port = storage.getRaw('obs_port');
        const encryptedPw = storage.getRaw('obs_pw');
        const isEncrypted = storage.getRaw('obs_pw_encrypted') === 'true';
        
        if (host) document.getElementById('host').value = host;
        if (port) document.getElementById('port').value = port;
        
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
                const password = await decryptPassword(encryptedPw, pin);
                if (password) {
                    document.getElementById('password').value = password;
                    sessionStorage.setItem('obs_pin', pin); // Remember for session
                    updateSecurityWarning();
                    return true;
                } else {
                    log('Wrong PIN or corrupted data', 'error');
                    sessionStorage.removeItem('obs_pin');
                    updateSecurityWarning();
                    return false;
                }
            } catch (e) {
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

function clearSavedCredentials() {
    storage.remove('obs_host');
    storage.remove('obs_port');
    storage.remove('obs_pw');
    storage.remove('obs_pw_encrypted');
    storage.remove('obs_remember');
    sessionStorage.removeItem('obs_pin');
    document.getElementById('host').value = 'localhost';
    document.getElementById('port').value = '4455';
    document.getElementById('password').value = '';
    document.getElementById('rememberCreds').checked = false;
    updateSecurityWarning();
    log('Saved credentials cleared', 'info');
}

function updateSecurityWarning() {
    const pw = document.getElementById('password').value;
    const remember = document.getElementById('rememberCreds').checked;
    const isEncrypted = storage.getRaw('obs_pw_encrypted') === 'true';
    const warn = document.getElementById('securityWarning');
    
    if (remember && pw) {
        if (isEncrypted) {
            warn.textContent = '🔐 Password encrypted with AES-256-GCM';
            warn.style.color = 'var(--success)';
        } else {
            warn.textContent = '🔒 Password will be encrypted with your PIN';
            warn.style.color = 'var(--accent)';
        }
    } else {
        warn.textContent = '';
    }
}

// ============ Connection State UI ============
function updateConnectionState() {
    const app = document.querySelector('.app');
    if (connected) {
        app.classList.remove('disconnected');
    } else {
        app.classList.add('disconnected');
    }
    
    // Disable action buttons when disconnected
    document.querySelectorAll('.source-btn, #startCycleBtn').forEach(btn => {
        btn.disabled = !connected;
    });
}

function updateConnectionUI() {
    const dot = document.getElementById('statusDot');
    const btn = document.getElementById('connectBtn');
    const headerBtn = document.getElementById('connectHeaderBtn');
    
    if (connected) {
        dot.className = 'status-dot connected';
        btn.textContent = 'Disconnect';
        btn.className = 'btn-danger btn-block';
        headerBtn.textContent = 'Connected';
        headerBtn.className = 'btn-success';
    } else {
        dot.className = 'status-dot';
        btn.textContent = 'Connect';
        btn.className = 'btn-primary btn-block';
        headerBtn.textContent = 'Connect';
        headerBtn.className = '';
    }
}

// ============ WebSocket Connection ============
function toggleConnection() {
    connected ? disconnect() : connect();
}

function connect() {
    const host = document.getElementById('host').value || 'localhost';
    const port = document.getElementById('port').value || '4455';
    const password = document.getElementById('password').value;
    
    document.getElementById('statusDot').className = 'status-dot connecting';
    log('Connecting...', 'info');
    
    try {
        ws = new WebSocket(`ws://${host}:${port}`);
        ws.onopen = () => {
            log('Socket open, authenticating...');
            reconnectAttempts = 0;
        };
        ws.onmessage = e => handleMessage(JSON.parse(e.data), password);
        ws.onerror = (e) => { 
            log('Connection error', 'error');
            console.log('WebSocket error:', e);
        };
        ws.onclose = (e) => { 
            const wasConnected = connected;
            connected = false;
            updateConnectionUI();
            updateConnectionState();
            
            // Reset script status on disconnect
            if (typeof scriptStatus !== 'undefined') {
                scriptStatus.connected = false;
            }
            if (typeof updateFeatureAvailability === 'function') {
                updateFeatureAvailability();
            }
            if (typeof renderStartupBanner === 'function') {
                renderStartupBanner();
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
    } catch (e) {
        log('Failed: ' + e.message, 'error');
        updateConnectionState();
    }
}

function disconnect() {
    reconnectAttempts = MAX_RECONNECT; // Prevent auto-reconnect
    if (ws) ws.close();
    connected = false;
    updateConnectionUI();
    updateConnectionState();
}

async function handleMessage(data, password) {
    // EventSubscription bitmask: All standard events (2047) ensures we get Vendors/CustomEvent (512)
    // This is critical for cross-client storage sync via BroadcastCustomEvent
    const EVENT_SUBSCRIPTIONS = (1 << 11) - 1; // 2047 = All standard events including Vendors
    
    if (data.op === 0) { // Hello
        const auth = data.d.authentication;
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
        connected = true;
        updateConnectionUI();
        updateConnectionState();
        await saveCredentials(); // Save on successful connection
        log('Connected to OBS!', 'success');
        
        // Call refreshScenes if available
        if (typeof refreshScenes === 'function') {
            refreshScenes();
        }
        
        // Restore saved opacity settings
        if (typeof restoreSavedOpacities === 'function') {
            setTimeout(restoreSavedOpacities, 800);
        }
        
        // Check script status after connection
        if (typeof checkScriptStatus === 'function') {
            setTimeout(checkScriptStatus, 500);
        }
        
        // Sync storage across connected clients
        if (typeof requestStorageSync === 'function') {
            setTimeout(requestStorageSync, 1000);
        }
    } else if (data.op === 7) { // Response
        const req = pendingRequests[data.d.requestId];
        if (req) {
            if (data.d.requestStatus.result) {
                req.resolve(data.d.responseData);
            } else {
                req.reject(data.d.requestStatus.comment);
            }
            delete pendingRequests[data.d.requestId];
        }
    } else if (data.op === 5) { // Event
        // Log ALL CustomEvents before filtering
        if (data.d?.eventType === 'CustomEvent') {
            console.log('[RAW CustomEvent]', JSON.stringify(data.d, null, 2));
        }
        handleEvent(data.d);
    }
}

function handleEvent(event) {
    // Debug: log all events to console (verbose mode)
    if (event.eventType !== 'SceneItemTransformChanged') { // Skip noisy events
        console.log('[OBS Event]', event.eventType, event.eventData);
    }
    
    if (event.eventType === 'CurrentProgramSceneChanged') {
        currentScene = event.eventData.sceneName;
        const currentSceneEl = document.getElementById('currentScene');
        if (currentSceneEl) {
            currentSceneEl.textContent = currentScene;
        }
        
        if (typeof refreshSources === 'function') {
            refreshSources();
        }
        if (typeof renderSavedLayouts === 'function') {
            renderSavedLayouts(); // Refresh layouts for new scene
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
        if (window.StorageSync && (customData?.type === 'strixun_storage_broadcast' || customData?.type === 'strixun_storage_request')) {
            window.StorageSync.handleCustomEvent(customData);
        } else if (customData?.type === 'strixun_text_cycler_msg') {
            // Handle text cycler messages from remote control panel (same pattern as quick swaps)
            // Remote sends via WebSocket, OBS dock receives and handles locally
            const configId = customData.configId;
            const message = customData.message;
            const timestamp = customData.timestamp || Date.now();
            
            if (configId && message) {
                // OBS dock: forward to localStorage so browser source can receive it
                if (typeof isOBSDock === 'function' && isOBSDock()) {
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

function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function request(type, data = {}) {
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

async function sha256(msg) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ============ Exports (for non-module usage) ============
// All functions are already global, but we expose them via window.WebSocket for clarity
if (typeof window !== 'undefined') {
    window.OBSWebSocket = {
        connect,
        disconnect,
        toggleConnection,
        send,
        request,
        saveCredentials,
        loadCredentials,
        clearSavedCredentials,
        updateSecurityWarning,
        updateConnectionState,
        updateConnectionUI,
        // State getters
        get ws() { return ws; },
        get connected() { return connected; },
        get currentScene() { return currentScene; },
        get sources() { return sources; },
        get msgId() { return msgId; }
    };
}

