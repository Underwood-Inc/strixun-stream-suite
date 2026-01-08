<script lang="ts">
  /**
   * Setup Page
   * 
   * OBS WebSocket connection, Twitch API settings, storage backup, and version info
   */
  
  import { ConfirmationModal, LoginModal, Tooltip } from '@components';
  import { StatusFlair } from '@strixun/status-flair';
  import { onMount } from 'svelte';
  import { stagger } from '../core/animations';
  import { EventBus } from '../core/events/EventBus';
  import * as App from '../modules/app';
  import { deleteCloudSave, listCloudSaves, loadFromCloud, saveToCloud, type CloudSave } from '../modules/cloud-save';
  import { openUrlOrCopy } from '../modules/script-status';
  import { storage } from '../modules/storage';
  import { manualStorageSync, requestStorageFromOBS, saveAutoSyncPref } from '../modules/storage-sync';
  import { checkForUpdates, openGitHubRepo } from '../modules/version';
  import { clearSavedCredentials, loadCredentials, toggleConnection, updateConnectionState, updateSecurityWarning } from '../modules/websocket';
  import { isAuthenticated, customer } from '../stores/auth';
  import { connected } from '../stores/connection';
  import { showToast } from '../stores/toast-queue';
  
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
  
  // Cloud save state
  let showLoginModal = false;
  let cloudSaves: CloudSave[] = [];
  let isLoadingCloudSaves = false;
  let isSavingToCloud = false;
  let saveSlotName = 'default';
  let saveDescription = '';
  let hasLoadedCloudSaves = false; // Guard to prevent infinite loop
  
  // Confirmation modal state
  let showClearCredentialsModal = false;
  
  onMount(async () => {
    // Set dock URL
    dockUrl = window.location.href;
    
    // Listen for dock URL updates from bootstrap (replaces direct DOM manipulation)
    const unsubscribeDockUrl = EventBus.on('app:dock-url-ready', (data: { url: string }) => {
      dockUrl = data.url;
      // Update DOM element if it exists (for legacy compatibility)
      const dockUrlEl = document.getElementById('dockUrl') as HTMLInputElement | null;
      if (dockUrlEl) dockUrlEl.value = data.url;
    });
    
    // Wait for DOM to be ready, then load credentials
    await new Promise(resolve => setTimeout(resolve, 50));
    await loadCredentials();
    
    // Load cloud saves if authenticated (reactive statement will handle this)
    // Don't call here to avoid conflict with reactive statement
    
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
    
    // Return cleanup function
    return () => {
      unsubscribeDockUrl();
    };
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
    copyStatus = ' Copied to clipboard!';
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
  
  // Separate reactive statements to prevent infinite loops
  $: {
    // Update last backup info
    const lastBackupEl = document.getElementById('lastBackupInfo');
    if (lastBackupEl) lastBackupInfo = lastBackupEl.textContent || '';
    
    // Update security warning
    const warningEl = document.getElementById('securityWarning');
    if (warningEl) securityWarning = warningEl.textContent || '';
  }
  
  // Watch ONLY authentication state for UI updates - NO automatic API calls
  let previousAuthState = false;
  
  $: {
    const authChanged = $isAuthenticated !== previousAuthState;
    previousAuthState = $isAuthenticated;
    
    // Only reset UI state on logout - NO automatic API calls
    if (authChanged && !$isAuthenticated) {
      hasLoadedCloudSaves = false;
      cloudSaves = [];
      // Clear any pending debounce timer
      if (loadCloudSavesDebounceTimer) {
        clearTimeout(loadCloudSavesDebounceTimer);
        loadCloudSavesDebounceTimer = null;
      }
    }
  }
  
  // Debounce timer to prevent rapid-fire API calls
  let loadCloudSavesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  async function loadCloudSavesList(): Promise<void> {
    if (!$isAuthenticated || isLoadingCloudSaves) return;
    
    // Clear any pending debounce timer
    if (loadCloudSavesDebounceTimer) {
      clearTimeout(loadCloudSavesDebounceTimer);
      loadCloudSavesDebounceTimer = null;
    }
    
    // Debounce the actual API call to prevent spam
    loadCloudSavesDebounceTimer = setTimeout(async () => {
      try {
        isLoadingCloudSaves = true;
        cloudSaves = await listCloudSaves();
        hasLoadedCloudSaves = true; // Mark as loaded
      } catch (error) {
        console.error('[Setup] Failed to load cloud saves:', error);
        showToast({ message: 'Failed to load cloud saves', type: 'error' });
        hasLoadedCloudSaves = false; // Reset on error so it can retry
      } finally {
        isLoadingCloudSaves = false;
        loadCloudSavesDebounceTimer = null;
      }
    }, 500); // 500ms debounce
  }
  
  async function handleSaveToCloud(): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    try {
      isSavingToCloud = true;
      const backup = App.getSelectedExportData();
      
      if (backup.exportedCategories.length === 0) {
        showToast({ message: 'Select at least one category to save', type: 'error' });
        return;
      }
      
      await saveToCloud(backup, saveSlotName, {
        name: saveDescription || undefined,
        description: saveDescription || undefined,
      });
      
      showToast({ message: 'Saved to cloud successfully', type: 'success' });
      saveSlotName = 'default';
      saveDescription = '';
      await loadCloudSavesList();
    } catch (error) {
      console.error('[Setup] Failed to save to cloud:', error);
      showToast({ message: error instanceof Error ? error.message : 'Failed to save to cloud', type: 'error' });
    } finally {
      isSavingToCloud = false;
    }
  }
  
  async function handleLoadFromCloud(slot: string): Promise<void> {
    if (!$isAuthenticated) {
      showLoginModal = true;
      return;
    }
    
    if (!confirm('This will import the cloud backup. Continue?')) {
      return;
    }
    
    try {
      const backup = await loadFromCloud(slot);
      App.importBackupData(backup);
      showToast({ message: 'Loaded from cloud successfully', type: 'success' });
    } catch (error) {
      console.error('[Setup] Failed to load from cloud:', error);
      showToast({ message: error instanceof Error ? error.message : 'Failed to load from cloud', type: 'error' });
    }
  }
  
  async function handleDeleteCloudSave(slot: string): Promise<void> {
    if (!confirm(`Delete cloud save "${slot}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteCloudSave(slot);
      showToast({ message: 'Cloud save deleted', type: 'success' });
      await loadCloudSavesList();
    } catch (error) {
      console.error('[Setup] Failed to delete cloud save:', error);
      showToast({ message: error instanceof Error ? error.message : 'Failed to delete cloud save', type: 'error' });
    }
  }
  
  function handleLoginClose(): void {
    showLoginModal = false;
    // NO automatic API calls - user must click "Refresh List" button to load cloud saves
  }
  
  function handleClearCredentialsClick(): void {
    showClearCredentialsModal = true;
  }
  
  async function handleClearCredentialsConfirm(): Promise<void> {
    showClearCredentialsModal = false;
    await clearSavedCredentials();
    // Sync back to Svelte variables
    host = 'localhost';
    port = '4455';
    password = '';
    rememberCreds = false;
  }
  
  function handleClearCredentialsCancel(): void {
    showClearCredentialsModal = false;
  }
</script>

<div class="page setup-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <div class="setup-cards-grid">
  <!-- Connection Card -->
  <div class="card connection-card">
    <h3>Connection</h3>
    <div class="connection-form">
      <div class="connection-row">
        <div class="connection-field">
          <label>Host</label>
          <input type="text" id="host" bind:value={host}>
        </div>
        <div class="connection-field">
          <label>Port</label>
          <input type="text" id="port" bind:value={port}>
        </div>
      </div>
      <div class="connection-field">
        <label>Password</label>
        <input type="password" id="password" bind:value={password} placeholder="Leave empty if not set">
      </div>
      <div class="connection-remember">
        <label class="remember-label">
          <input type="checkbox" id="rememberCreds" bind:checked={rememberCreds}>
          <span>Remember credentials</span>
        </label>
        {#if securityWarning}
          <p class="security-warning" id="securityWarning">
            {securityWarning}
          </p>
        {/if}
      </div>
      <div class="connection-actions">
        <button class="btn-primary btn-connect" id="connectBtn" on:click={toggleConnection}>
          {$connected ? 'Disconnect' : 'Connect'}
        </button>
        <button 
          type="button" 
          class="btn-clear-credentials" 
          on:click={handleClearCredentialsClick}
        >
          Clear Saved Credentials
        </button>
      </div>
    </div>
  </div>
  
  <!-- OBS Dock Card -->
  <div class="card">
    <h3>Add as OBS Dock</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.9em">
      In OBS: <strong>View  Docks  Custom Browser Docks</strong><br>
      Click + and paste this URL:
    </p>
    <div class="url-box">
      <input type="text" id="dockUrl" bind:value={dockUrl} readonly>
      <button on:click={handleCopyUrl}>✓ Copy</button>
    </div>
    <p style="color:var(--muted);margin-top:8px;font-size:0.85em" id="copyStatus">
      {copyStatus}
    </p>
  </div>
  
  <!-- OBS WebSocket Setup Card -->
  <div class="card">
    <h3>OBS WebSocket Setup</h3>
    <ol style="color:var(--muted);padding-left:20px;font-size:0.9em;line-height:2">
      <li>In OBS: <strong>Tools  WebSocket Server Settings</strong></li>
      <li>Check "Enable WebSocket server"</li>
      <li>Note the port (default: 4455)</li>
      <li>Set password if desired</li>
      <li>Click Apply, then connect here</li>
    </ol>
  </div>
  
  <!-- Twitch API Settings Card -->
  <div class="card">
    <h3> Twitch API Settings</h3>
    <p style="color:var(--muted);font-size:0.85em;margin-bottom:12px">
      Get credentials from 
      <button on:click={handleOpenTwitchConsole} class="btn-link">dev.twitch.tv/console</button>
    </p>
    
    <label>Twitch Client ID <span style="color:var(--muted);font-weight:normal">(Optional - Auto-configured)</span></label>
    <input type="text" id="twitchClientId" bind:value={twitchClientId} placeholder="Auto-configured from deployment">
    <p class="hint" style="margin-top:4px;font-size:0.75em">
      → Auto-configured during deployment. Only override if using a different Twitch app.
      <span id="autoDetectedClientId" style="display:block;margin-top:4px;color:var(--success)"></span>
    </p>
    
    <label style="margin-top:12px">API Server URL <span style="color:var(--muted);font-weight:normal">(Optional - Auto-detected)</span></label>
    <input type="text" id="twitchApiServer" bind:value={twitchApiServer} placeholder="Auto-detected from deployment config">
    <p class="hint" style="margin-top:4px;font-size:0.75em">
      → Auto-configured during GitHub Pages deployment. Only override if using a custom Worker URL.
      <span id="autoDetectedApiUrl" style="display:block;margin-top:4px;color:var(--success)"></span>
    </p>
    
    <div style="margin-top:12px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:0.8em">
      <strong style="color:var(--accent)">OAuth Redirect URI:</strong>
      <code style="display:block;margin-top:4px;padding:6px;background:var(--bg);border-radius:4px;word-break:break-all;user-select:all">
        https://streamkit.idling.app/twitch_auth_callback.html
      </code>
      <p style="color:var(--muted);margin-top:4px"> Add this URL to your Twitch app's OAuth Redirect URLs</p>
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button on:click={handleSaveTwitchSettings} style="padding:8px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer">
         Save Settings
      </button>
      <button on:click={handleTestTwitchApi} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer">
         Test Connection
      </button>
    </div>
    <div id="twitchApiStatus" style="margin-top:8px;font-size:0.8em;text-align:center;color:var(--muted)"></div>
  </div>
  
  <!-- Keyboard Shortcuts Card -->
  <Tooltip text="Keyboard Shortcuts | This feature is currently in testing" level="info" position="top">
    <StatusFlair status="in-testing">
      <div class="card">
      <h3>Keyboard Shortcuts</h3>
    <p style="color:var(--muted);font-size:0.9em">When this panel is focused:</p>
    <ul style="color:var(--muted);padding-left:20px;font-size:0.9em;line-height:2">
      <li><strong>1-9</strong> - Trigger saved swap configs</li>
      <li><strong>Space</strong> - Start/stop text cycler</li>
    </ul>
      </div>
    </StatusFlair>
  </Tooltip>
  
  <!-- Cross-Client Sync Card -->
  <Tooltip text="Cross-Client Sync | This feature is currently in testing" level="info" position="top">
    <StatusFlair status="in-testing">
      <div class="card">
      <h3> ★ Cross-Client Sync</h3>
    <p style="color:var(--muted);font-size:0.85em;margin-bottom:8px">
      Sync configs between OBS dock and remote browser panels via WebSocket.
    </p>
    <div style="display:grid;gap:8px">
      <Tooltip 
        text={$connected ? 'Overwrite local storage with data from OBS dock' : 'Connect to OBS first to sync storage'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button class="btn-primary btn-block" class:requires-connection={true} disabled={!$connected} on:click={handleRequestStorageFromOBS}>
           Pull Storage from OBS Dock
        </button>
      </Tooltip>
      <Tooltip 
        text={$connected ? 'Send local storage to other connected clients' : 'Connect to OBS first to sync storage'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button class="btn-block" class:requires-connection={true} disabled={!$connected} style="background:var(--border)" on:click={handleManualStorageSync}>
           Push Storage to Other Clients
        </button>
      </Tooltip>
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
    </StatusFlair>
  </Tooltip>
  
  <!-- Data & Backup Card -->
  <Tooltip text="Data & Backup | This feature is currently in testing" level="info" position="top">
    <StatusFlair status="in-testing">
      <div class="card">
      <h3> Data & Backup</h3>
    
    <!-- Storage Engine Status -->
    <div id="storageEngineStatus" style="display:flex;gap:12px;margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;font-size:0.85em">
      <span id="idbStatus"> IndexedDB</span>
      <span id="lsStatus"> localStorage</span>
    </div>
    
    <!-- Data Categories -->
    <div style="margin-bottom:12px">
      <div style="font-size:0.8em;color:var(--muted);margin-bottom:6px;font-weight:600">SELECT DATA TO EXPORT:</div>
      <div style="display:grid;gap:6px">
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportSwaps" bind:checked={exportSwaps} style="width:auto;margin:0">
          <span> ★ Swap Configs</span>
          <span id="swapCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportLayouts" bind:checked={exportLayouts} style="width:auto;margin:0">
          <span> Layout Presets</span>
          <span id="layoutCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportTextCyclers" bind:checked={exportTextCyclers} style="width:auto;margin:0">
          <span> ★ Text Cycler Configs</span>
          <span id="textCyclerCount" style="margin-left:auto;color:var(--muted);font-size:0.9em">(0)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportUIState" bind:checked={exportUIState} style="width:auto;margin:0">
          <span>≡ UI Preferences</span>
          <span style="margin-left:auto;color:var(--muted);font-size:0.9em">(dropdowns, settings)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:0.85em">
          <input type="checkbox" id="exportCredentials" bind:checked={exportCredentials} style="width:auto;margin:0">
          <span> ★ Connection Settings</span>
          <span style="margin-left:auto;color:var(--warning);font-size:0.8em">(host/port only)</span>
        </label>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <button on:click={App.exportSelectedData} style="padding:10px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:500">
         Export Selected
      </button>
      <button on:click={App.importDataWithOptions} style="padding:10px;background:var(--accent);border:none;color:#000;border-radius:6px;cursor:pointer;font-weight:500">
         Import Backup
      </button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button on:click={App.forceStorageSync} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        → Force Sync
      </button>
      <button on:click={App.copyBackupToClipboard} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
        ✓ Copy as JSON
      </button>
    </div>
    
    <!-- Info -->
    <div style="margin-top:10px;padding:8px;background:rgba(255,200,0,0.1);border-radius:6px;border-left:3px solid var(--warning)">
      <p style="font-size:0.75em;color:var(--warning);margin:0">
        ⚠ <strong>OBS browser docks can lose data</strong> when cache is cleared. Export backups regularly!
      </p>
    </div>
    
    <!-- Last backup info -->
    <div id="lastBackupInfo" style="margin-top:8px;font-size:0.75em;color:var(--muted);text-align:center"></div>
      </div>
    </StatusFlair>
  </Tooltip>
  
  <!-- Cloud Backup Card -->
  <Tooltip text="Cloud Backup | This feature is currently in testing" level="info" position="top">
    <StatusFlair status="in-testing">
      <div class="card">
      <h3> Cloud Backup</h3>
    
    {#if !$isAuthenticated}
      <p style="color:var(--muted);font-size:0.9em;margin-bottom:12px">
        Sign in to save and restore your app state from the cloud
      </p>
      <button 
        id="cloud-backup-login-btn"
        class="btn-primary btn-block" 
        on:click={() => showLoginModal = true}
        style="padding:10px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:500"
      >
        ✓ Sign In to Use Cloud Backup
      </button>
    {:else}
      <p style="color:var(--muted);font-size:0.85em;margin-bottom:12px">
        Signed in as <strong>{$user?.displayName || 'Customer'}</strong>
      </p>
      
      <!-- Save to Cloud -->
      <div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px">
        <div style="font-size:0.8em;color:var(--muted);margin-bottom:8px;font-weight:600">SAVE TO CLOUD:</div>
        <div style="display:grid;gap:8px">
          <input 
            type="text" 
            bind:value={saveSlotName}
            placeholder="Save slot name (default)"
            style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.9em"
          />
          <input 
            type="text" 
            bind:value={saveDescription}
            placeholder="Optional description"
            style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.9em"
          />
          <button 
            class="btn-primary btn-block" 
            on:click={handleSaveToCloud}
            disabled={isSavingToCloud}
            style="padding:10px;background:var(--primary);border:none;color:#fff;border-radius:6px;cursor:pointer;font-weight:500;opacity:{isSavingToCloud ? 0.5 : 1}"
          >
            {isSavingToCloud ? 'Saving...' : ' Save to Cloud'}
          </button>
        </div>
      </div>
      
      <!-- Cloud Saves List -->
      <div style="margin-bottom:12px">
        <div style="font-size:0.8em;color:var(--muted);margin-bottom:8px;font-weight:600">CLOUD SAVES:</div>
        {#if isLoadingCloudSaves}
          <div style="text-align:center;padding:16px;color:var(--muted)">Loading...</div>
        {:else if cloudSaves.length === 0}
          <div style="text-align:center;padding:16px;color:var(--muted);font-size:0.9em">No cloud saves yet</div>
        {:else}
          <div style="display:flex;flex-direction:column;gap:8px">
            {#each cloudSaves as save}
              <div style="padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;border:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                  <div>
                    <div style="font-weight:600;color:var(--text);margin-bottom:4px">
                      {save.metadata.name || save.slot}
                    </div>
                    <div style="font-size:0.75em;color:var(--muted)">
                      {new Date(save.timestamp).toLocaleString()}
                    </div>
                    {#if save.exportedCategories.length > 0}
                      <div style="font-size:0.7em;color:var(--muted);margin-top:4px">
                        {save.exportedCategories.join(', ')}
                      </div>
                    {/if}
                  </div>
                  <div style="display:flex;gap:4px">
                    <button 
                      on:click={() => handleLoadFromCloud(save.slot)}
                      style="padding:6px 12px;background:var(--accent);border:none;color:#000;border-radius:4px;cursor:pointer;font-size:0.8em;font-weight:500"
                    >
                      Load
                    </button>
                    <button 
                      on:click={() => handleDeleteCloudSave(save.slot)}
                      style="padding:6px 12px;background:var(--error);border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:0.8em"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <button 
        on:click={loadCloudSavesList}
        disabled={isLoadingCloudSaves}
        style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em;width:100%"
      >
        → Refresh List
      </button>
    {/if}
      </div>
    </StatusFlair>
  </Tooltip>
  
  {#if showLoginModal}
    <LoginModal onClose={handleLoginClose} />
  {/if}
  
  {#if showClearCredentialsModal}
    <ConfirmationModal
      title="Clear Saved Credentials"
      message="This will permanently delete all saved connection credentials (host, port, and password) from both local and cloud storage. This action cannot be undone."
      confirmLabel="Clear Credentials"
      cancelLabel="Cancel"
      confirmVariant="danger"
      onConfirm={handleClearCredentialsConfirm}
      onCancel={handleClearCredentialsCancel}
    />
  {/if}
  
  <!-- Version Info Card -->
  <Tooltip text="Version | This feature is currently in testing" level="info" position="top">
    <StatusFlair status="in-testing">
      <div class="card">
      <h3> ★ Version</h3>
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
        → Check Updates
      </button>
      <button on:click={handleOpenGitHubRepo} style="padding:8px;background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85em">
         Open GitHub
      </button>
    </div>
    <div style="margin-top:10px;font-size:0.75em;color:var(--muted);text-align:center">
      <span id="lastVersionCheck">Never checked</span>
    </div>
      </div>
    </StatusFlair>
  </Tooltip>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  @use '@styles/mixins' as *;
  
  .setup-page {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    
    .setup-cards-grid {
      column-count: auto;
      column-width: 350px;
      column-gap: 20px;
      column-fill: balance;
    }
    
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .connection-card {
      .connection-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .connection-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      
      .connection-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        
        label {
          font-size: 0.9em;
          font-weight: 500;
          color: var(--text);
        }
        
        input {
          width: 100%;
        }
      }
      
      .connection-remember {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 4px;
        
        .remember-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.9em;
          
          input[type="checkbox"] {
            width: auto;
            margin: 0;
          }
        }
        
        .security-warning {
          font-size: 0.75em;
          color: var(--warning);
          margin: 0;
          padding: 0;
        }
      }
      
      .connection-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
        
        .btn-connect {
          flex: 1;
          min-width: 120px;
          padding: 10px 16px;
          background: var(--primary, var(--accent));
          border: none;
          color: #000;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          word-wrap: break-word;
          white-space: normal;
          
          &:hover {
            background: var(--primary-dark, var(--accent-dark));
          }
        }
        
        .btn-clear-credentials {
          flex: 1;
          min-width: 140px;
          padding: 10px 16px;
          background: var(--danger);
          border: none;
          color: #000;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 0.9em;
          transition: all 0.2s;
          word-wrap: break-word;
          white-space: normal;
          
          &:hover {
            background: var(--danger-dark, rgba(var(--danger-rgb, 255, 0, 0), 0.8));
          }
        }
      }
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

    // Make tooltip wrapper full width when containing btn-block buttons
    :global(.tooltip-wrapper:has(button.btn-block)) {
      width: 100%;
      display: flex;
    }
    
    // Ensure btn-block buttons inside tooltip wrappers are full width
    :global(.tooltip-wrapper:has(button.btn-block) button.btn-block) {
      width: 100%;
    }

    // Ensure cards size naturally based on content and break properly in columns
    .card {
      display: flex;
      flex-direction: column;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 20px;
      width: 350px;
    }
  }

  // Responsive adjustments
  @media (max-width: 768px) {
    .setup-page {
      padding: 12px;
      
      .setup-cards-grid {
        column-count: 1;
        column-width: 100%;
      }
      
      .card {
        width: 100%;
      }
      
      .connection-card .connection-actions {
        flex-direction: column;
        
        .btn-connect,
        .btn-clear-credentials {
          flex: 1;
          width: 100%;
          min-width: unset;
        }
      }
    }
  }
  
  // Very small screens - stack buttons vertically
  @media (max-width: 400px) {
    .setup-page .connection-card .connection-actions {
      flex-direction: column;
      
      .btn-connect,
      .btn-clear-credentials {
        width: 100%;
        min-width: unset;
      }
    }
  }

  @media (min-width: 1200px) {
    .setup-page .setup-cards-grid {
      column-width: 380px;
    }
    
    .setup-page .card {
      width: 380px;
    }
  }

  @media (min-width: 1600px) {
    .setup-page .setup-cards-grid {
      column-width: 440px;
    }
    
    .setup-page .card {
      width: 440px;
    }
  }
</style>
