<script lang="ts">
  /**
   * Setup Page
   * 
   * OBS WebSocket connection, Twitch API settings, storage backup, and version info
   */
  
  import { onMount } from 'svelte';
  import { connected } from '../stores/connection';
  import { connect, disconnect, toggleConnection, loadCredentials, clearSavedCredentials, updateSecurityWarning, updateConnectionState } from '../modules/websocket';
  import { openUrlOrCopy } from '../modules/script-status';
  import * as App from '../modules/app';
  import { requestStorageFromOBS, manualStorageSync, saveAutoSyncPref } from '../modules/storage-sync';
  import { checkForUpdates, openGitHubRepo } from '../modules/version';
  import { storage } from '../modules/storage';
  
  let host = 'localhost';
  let port = '4455';
  let password = '';
  let rememberCreds = false;
  let securityWarning = '';
  let dockUrl = '';
  let copyStatus = '';
  let twitchClientId = '';
  let twitchApiServer = '';
  let autoDetectedClientId = '';
  let autoDetectedApiUrl = '';
  let twitchApiStatus = '';
  let autoSyncOnConnect = true;
  let lastBackupInfo = '';
  let localVersion = '--';
  let remoteVersion = '--';
  let versionStatus = 'Click below to check for updates';
  let lastVersionCheck = 'Never checked';
  
  // Export checkboxes
  let exportSwaps = true;
  let exportLayouts = true;
  let exportTextCyclers = true;
  let exportUIState = true;
  let exportCredentials = false;
  
  onMount(async () => {
    // Set dock URL
    dockUrl = window.location.href;
    
    // Wait for DOM to be ready, then load credentials
    await new Promise(resolve => setTimeout(resolve, 50));
    await loadCredentials();
    
    // Sync loaded values back to Svelte variables
    const hostEl = document.getElementById('host') as HTMLInputElement;
    const portEl = document.getElementById('port') as HTMLInputElement;
    const passwordEl = document.getElementById('password') as HTMLInputElement;
    const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
    
    if (hostEl) host = hostEl.value || 'localhost';
    if (portEl) port = portEl.value || '4455';
    if (passwordEl) password = passwordEl.value;
    if (rememberEl) rememberCreds = rememberEl.checked;
    
    // Load Twitch settings
    if ((window as any).TwitchAPI?.loadTwitchSettings) {
      (window as any).TwitchAPI.loadTwitchSettings();
    }
    setTimeout(updateTwitchDisplay, 100);
    
    // Load auto-sync preference
    const savedAutoSync = storage.getRaw('autoSyncOnConnect') as boolean | null;
    if (savedAutoSync !== null) autoSyncOnConnect = savedAutoSync;
    
    // Update storage status
    App.updateStorageStatus();
    
    // Update connection state
    updateConnectionState();
    
    // Update security warning
    setTimeout(updateSecurityWarning, 100);
    
    // Initialize version display
    if ((window as any).Version?.initVersionDisplay) {
      (window as any).Version.initVersionDisplay();
    }
    setTimeout(updateVersionDisplay, 100);
  });
  
  // Sync Svelte variables to DOM elements (for websocket module compatibility)
  $: {
    const hostEl = document.getElementById('host') as HTMLInputElement;
    const portEl = document.getElementById('port') as HTMLInputElement;
    const passwordEl = document.getElementById('password') as HTMLInputElement;
    const rememberEl = document.getElementById('rememberCreds') as HTMLInputElement;
    
    if (hostEl && hostEl.value !== host) hostEl.value = host;
    if (portEl && portEl.value !== port) portEl.value = port;
    if (passwordEl && passwordEl.value !== password) passwordEl.value = password;
    if (rememberEl && rememberEl.checked !== rememberCreds) rememberEl.checked = rememberCreds;
  }
  
  function updateTwitchDisplay(): void {
    const clientIdEl = document.getElementById('twitchClientId') as HTMLInputElement;
    const apiServerEl = document.getElementById('twitchApiServer') as HTMLInputElement;
    const autoDetectedClientEl = document.getElementById('autoDetectedClientId');
    const autoDetectedApiEl = document.getElementById('autoDetectedApiUrl');
    
    if (clientIdEl) twitchClientId = clientIdEl.value;
    if (apiServerEl) twitchApiServer = apiServerEl.value;
    if (autoDetectedClientEl) autoDetectedClientId = autoDetectedClientEl.innerHTML;
    if (autoDetectedApiEl) autoDetectedApiUrl = autoDetectedApiEl.innerHTML;
  }
  
  function updateVersionDisplay(): void {
    const localEl = document.getElementById('localVersion');
    const remoteEl = document.getElementById('remoteVersion');
    const statusEl = document.getElementById('versionStatus');
    const lastCheckEl = document.getElementById('lastVersionCheck');
    
    if (localEl) localVersion = localEl.textContent || '--';
    if (remoteEl) remoteVersion = remoteEl.textContent || '--';
    if (statusEl) versionStatus = statusEl.innerHTML;
    if (lastCheckEl) lastVersionCheck = lastCheckEl.textContent || 'Never checked';
  }
  
  function handleCopyUrl(): void {
    App.copyUrl();
    copyStatus = '✓ Copied to clipboard!';
    setTimeout(() => { copyStatus = ''; }, 2000);
  }
  
  function handleSaveTwitchSettings(): void {
    if ((window as any).TwitchAPI?.saveTwitchSettings) {
      (window as any).TwitchAPI.saveTwitchSettings();
    }
    updateTwitchDisplay();
  }
  
  async function handleTestTwitchApi(): Promise<void> {
    if ((window as any).TwitchAPI?.testTwitchApi) {
      await (window as any).TwitchAPI.testTwitchApi();
    }
    const statusEl = document.getElementById('twitchApiStatus');
    if (statusEl) twitchApiStatus = statusEl.innerHTML;
  }
  
  function handleOpenTwitchConsole(): void {
    openUrlOrCopy('https://dev.twitch.tv/console/apps', 'Twitch Developer Console');
  }
  
  function handleRequestStorageFromOBS(): void {
    if (!$connected) {
      if ((window as any).App?.log) {
        (window as any).App.log('Connect to OBS first', 'error');
      }
      return;
    }
    requestStorageFromOBS();
  }
  
  function handleManualStorageSync(): void {
    if (!$connected) {
      if ((window as any).App?.log) {
        (window as any).App.log('Connect to OBS first', 'error');
      }
      return;
    }
    manualStorageSync();
  }
  
  function handleSaveAutoSyncPref(): void {
    saveAutoSyncPref();
    const autoSyncEl = document.getElementById('autoSyncOnConnect') as HTMLInputElement;
    if (autoSyncEl) autoSyncOnConnect = autoSyncEl.checked;
  }
  
  async function handleCheckForUpdates(): Promise<void> {
    await checkForUpdates();
    setTimeout(updateVersionDisplay, 1000);
  }
  
  function handleOpenGitHubRepo(): void {
    openGitHubRepo();
  }
  
  $: {
    // Update last backup info
    const lastBackupEl = document.getElementById('lastBackupInfo');
    if (lastBackupEl) lastBackupInfo = lastBackupEl.textContent || '';
    
    // Update security warning
    const warningEl = document.getElementById('securityWarning');
    if (warningEl) securityWarning = warningEl.textContent || '';
  }
</script>

<div class="page setup-page">
  <!-- Connection Card -->
  <div class="card">
    <h3>Connection</h3>
    <div class="row">
      <div>
        <label>Host</label>
        <input type="text" id="host" bind:value={host}>
      </div>
      <div>
        <label>Port</label>
        <input type="text" id="port" bind:value={port}>
      </div>
    </div>
    <label>Password</label>
    <input type="password" id="password" bind:value={password} placeholder="Leave empty if not set">
    <div style="margin:8px 0">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="rememberCreds" bind:checked={rememberCreds} style="width:auto;margin:0">
        <span>Remember credentials</span>
      </label>
      <p style="font-size:0.75em;color:var(--warning);margin-top:4px" id="securityWarning">
        {securityWarning}
      </p>
      <button type="button" on:click={clearSavedCredentials} style="font-size:0.75em;padding:4px 8px;margin-top:4px;background:var(--danger);border:none;color:#fff;border-radius:4px;cursor:pointer">
        Clear Saved Credentials
      </button>
    </div>
    <button class="btn-primary btn-block" id="connectBtn" on:click={toggleConnection}>
      {$connected ? 'Disconnect' : 'Connect'}
    </button>
  </div>
  
  <!-- OBS Dock Card -->
  <div class="card">
    <h3>Add as OBS Dock</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.9em">
      In OBS: <strong>View → Docks → Custom Browser Docks</strong><br>
      Click + and paste this URL:
    </p>
    <div class="url-box">
      <input type="text" id="dockUrl" bind:value={dockUrl} readonly>
      <button on:click={handleCopyUrl}>📋 Copy</button>
    </div>
    <p style="color:var(--muted);margin-top:8px;font-size:0.85em" id="copyStatus">
      {copyStatus}
    </p>
  </div>
  
  <!-- OBS WebSocket Setup Card -->
  <div class="card">
    <h3>OBS WebSocket Setup</h3>
    <ol style="color:var(--muted);padding-left:20px;font-size:0.9em;line-height:2">
      <li>In OBS: <strong>Tools → WebSocket Server Settings</strong></li>
      <li>Check "Enable WebSocket server"</li>
      <li>Note the port (default: 4455)</li>
      <li>Set password if desired</li>
      <li>Click Apply, then connect here</li>
    </ol>
  </div>
  
  <!-- Twitch API Settings Card -->
  <div class="card">
    <h3>🎮 Twitch API Settings</h3>
    <p style="color:var(--muted);font-size:0.85em;margin-bottom:12px">
      Get credentials from 
      <button on:click={handleOpenTwitchConsole} class="btn-link">dev.twitch.tv/console</button>
    </p>
    
    <label>Twitch Client ID <span style="color:var(--muted);font-weight:normal">(Optional - Auto-configured)</span></label>
    <input type="text" id="twitchClientId" bind:value={twitchClientId} placeholder="Auto-configured from deployment">
    <p class="hint" style="margin-top:4px;font-size:0.75em">
      ✨ Auto-configured during deployment. Only override if using a different Twitch app.
      <span id="autoDetectedClientId" style="display:block;margin-top:4px;color:var(--success)"></span>
    </p>
    
    <label style="margin-top:12px">API Server URL <span style="color:var(--muted);font-weight:normal">(Optional - Auto-detected)</span></label>
    <input type="text" id="twitchApiServer" bind:value={twitchApiServer} placeholder="Auto-detected from deployment config">
    <p class="hint" style="margin-top:4px;font-size:0.75em">
      ✨ Auto-configured during GitHub Pages deployment. Only override if using a custom Worker URL.
      <span id="autoDetectedApiUrl" style="display:block;margin-top:4px;color:var(--success)"></span>
    </p>
    
    <div style="margin-top:12px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.8em">
      <strong style="color:var(--accent)">OAuth Redirect URI:</strong>
      <code style="display:block;margin-top:4px;padding:6px;background:var(--bg);border-radius:4px;word-break:break-all;user-select:all">
        https://underwood-inc.github.io/strixun-stream-suite/twitch_auth_callback.html
      </code>
      <p style="color:var(--muted);margin-top:4px">☝️ Add this URL to your Twitch app's OAuth Redirect URLs</p>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button on:click={handleSaveTwitchSettings} style="padding:8px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer">
        💾 Save Settings
      </button>
      <button on:click={handleTestTwitchApi} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer">
        🔌 Test Connection
      </button>
    </div>
    <div id="twitchApiStatus" style="margin-top:8px;font-size:0.8em;text-align:center;color:var(--muted)"></div>
  </div>
  
  <!-- Keyboard Shortcuts Card -->
  <div class="card">
    <h3>Keyboard Shortcuts</h3>
    <p style="color:var(--muted);font-size:0.9em">When this panel is focused:</p>
    <ul style="color:var(--muted);padding-left:20px;font-size:0.9em;line-height:2">
      <li><strong>1-9</strong> - Trigger saved swap configs</li>
      <li><strong>Space</strong> - Start/stop text cycler</li>
    </ul>
  </div>
  
  <!-- Cross-Client Sync Card -->
  <div class="card">
    <h3>🔄 Cross-Client Sync</h3>
    <p style="color:var(--muted);font-size:0.85em;margin-bottom:8px">
      Sync configs between OBS dock and remote browser panels via WebSocket.
    </p>
    <div style="display:grid;gap:8px">
      <button class="btn-primary btn-block" class:requires-connection={true} disabled={!$connected} on:click={handleRequestStorageFromOBS}>
        📥 Pull Storage from OBS Dock
      </button>
      <button class="btn-block" class:requires-connection={true} disabled={!$connected} style="background:var(--border)" on:click={handleManualStorageSync}>
        📡 Push Storage to Other Clients
      </button>
    </div>
    <p class="hint" style="margin-top:6px">
      <strong>Pull</strong> = Overwrite local with OBS dock's storage<br>
      <strong>Push</strong> = Send your storage to other clients
    </p>
    <div class="form-check" style="margin-top:8px">
      <input type="checkbox" id="autoSyncOnConnect" bind:checked={autoSyncOnConnect} on:change={handleSaveAutoSyncPref}>
      <label for="autoSyncOnConnect">Auto-pull from OBS on connect</label>
    </div>
  </div>
  
  <!-- Data & Backup Card -->
  <div class="card">
    <h3>💾 Data & Backup</h3>
    
    <!-- Storage Engine Status -->
    <div id="storageEngineStatus" style="display:flex;gap:12px;margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:0.85em">
      <span id="idbStatus">⏳ IndexedDB</span>
      <span id="lsStatus">⏳ localStorage</span>
    </div>
    
    <!-- Data Categories -->
    <div style="margin-bottom:12px">
      <div style="font-size:0.8em;color:var(--muted);margin-bottom:6px;font-weight:600">SELECT DATA TO EXPORT:</div>
      <div style="display:grid;gap:6px">
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportSwaps" bind:checked={exportSwaps} style="width:auto;margin:0">
          <span>🔄 Swap Configs</span>
          <span id="swapCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportLayouts" bind:checked={exportLayouts} style="width:auto;margin:0">
          <span>📐 Layout Presets</span>
          <span id="layoutCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportTextCyclers" bind:checked={exportTextCyclers} style="width:auto;margin:0">
          <span>📝 Text Cycler Configs</span>
          <span id="textCyclerCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportUIState" bind:checked={exportUIState} style="width:auto;margin:0">
          <span>⚙️ UI Preferences</span>
          <span style="margin-left:auto;color:var(--muted);font-size:0.9em">(dropdowns, settings)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportCredentials" bind:checked={exportCredentials} style="width:auto;margin:0">
          <span>🔐 Connection Settings</span>
          <span style="margin-left:auto;color:var(--warning);font-size:0.8em">(host/port only)</span>
        </label>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <button on:click={App.exportSelectedData} style="padding:10px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:500">
        📤 Export Selected
      </button>
      <button on:click={App.importDataWithOptions} style="padding:10px;background:var(--accent);border:none;color:#000;border-radius:6px;cursor:pointer;font-weight:500">
        📥 Import Backup
      </button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button on:click={App.forceStorageSync} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        🔄 Force Sync
      </button>
      <button on:click={App.copyBackupToClipboard} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        📋 Copy as JSON
      </button>
    </div>
    
    <!-- Info -->
    <div style="margin-top:10px;padding:8px;background:rgba(255,200,0,0.1);border-radius:6px;border-left:3px solid var(--warning)">
      <p style="font-size:0.75em;color:var(--warning);margin:0">
        ⚠️ <strong>OBS browser docks can lose data</strong> when cache is cleared. Export backups regularly!
      </p>
    </div>
    
    <!-- Last backup info -->
    <div id="lastBackupInfo" style="margin-top:8px;font-size:0.75em;color:var(--muted);text-align:center"></div>
  </div>
  
  <!-- Version Info Card -->
  <div class="card">
    <h3>📦 Version</h3>
    <div id="versionInfo" style="font-size:0.9em">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span style="color:var(--muted)">Local Version:</span>
        <span id="localVersion" style="font-weight:600;font-family:monospace">--</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
        <span style="color:var(--muted)">Remote (main):</span>
        <span id="remoteVersion" style="font-weight:600;font-family:monospace">--</span>
      </div>
      <div id="versionStatus" style="margin-top:10px;padding:8px;border-radius:6px;text-align:center;font-size:0.85em">
        <span style="color:var(--muted)">Click below to check for updates</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button on:click={handleCheckForUpdates} style="padding:8px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        🔄 Check Updates
      </button>
      <button on:click={handleOpenGitHubRepo} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        🐙 Open GitHub
      </button>
    </div>
    <div style="margin-top:10px;font-size:0.75em;color:var(--muted);text-align:center">
      <span id="lastVersionCheck">Never checked</span>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .setup-page {
    max-width: 1200px;
    margin: 0 auto;
    
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .url-box {
      display: flex;
      gap: 8px;
      
      input {
        flex: 1;
      }
      
      button {
        padding: 8px 16px;
        background: var(--accent);
        border: none;
        color: #000;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        
        &:hover {
          background: var(--accent-dark);
        }
      }
    }
    
    .btn-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      
      &:hover {
        text-decoration: underline;
      }
    }
    
    .form-check {
      display: flex;
      align-items: center;
      gap: 8px;
      
      input[type="checkbox"] {
        width: auto;
        margin: 0;
      }
    }
    
    .requires-connection:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
