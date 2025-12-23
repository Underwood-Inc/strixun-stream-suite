<script lang="ts">
  /**
   * Install Page
   * 
   * Installation wizard for Lua scripts
   */
  
  import { onMount } from 'svelte';
  import { stagger } from '../core/animations';
  
  onMount(() => {
    // Initialize installer if available
    if ((window as any).Installer && (window as any).Installer.init) {
      (window as any).Installer.init();
    }
  });
  
  function handleDetectSourcePath(): void {
    if ((window as any).Installer && (window as any).Installer.detectSourcePath) {
      (window as any).Installer.detectSourcePath();
    }
  }
  
  function handleBrowseTargetPath(): void {
    if ((window as any).Installer && (window as any).Installer.browseTargetPath) {
      (window as any).Installer.browseTargetPath();
    }
  }
  
  function handleDetectOBSPath(): void {
    if ((window as any).Installer && (window as any).Installer.detectOBSPath) {
      (window as any).Installer.detectOBSPath();
    }
  }
  
  function handleGoToInstallStep(step: number): void {
    if ((window as any).Installer && (window as any).Installer.goToInstallStep) {
      (window as any).Installer.goToInstallStep(step);
    }
  }
  
  function handleGenerateInstallScript(): void {
    if ((window as any).Installer && (window as any).Installer.generateInstallScript) {
      (window as any).Installer.generateInstallScript();
    }
  }
  
  function handleCopyInstallScript(): void {
    if ((window as any).Installer && (window as any).Installer.copyInstallScript) {
      (window as any).Installer.copyInstallScript();
    }
  }
</script>

<div class="page install-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <div class="card">
    <h3>📥 Installation Wizard</h3>
    <p class="hint">Automatically install Lua scripts to your OBS scripts folder.</p>
    
    <!-- Step 1: Detect/Select Paths -->
    <div id="installStep1" class="install-step active">
      <h4>Step 1: Configure Paths</h4>
      
      <label>Source Files Location</label>
      <div class="url-box">
        <input type="text" id="installSourcePath" readonly>
        <button on:click={handleDetectSourcePath}>🔍 Detect</button>
      </div>
      <p class="hint">Where the script files are located (this folder)</p>
      
      <label>OBS Scripts Folder</label>
      <div class="url-box">
        <input type="text" id="installTargetPath" placeholder="C:\Users\YourName\AppData\Roaming\obs-studio\scripts">
        <button on:click={handleBrowseTargetPath}>📁 Browse</button>
        <button on:click={handleDetectOBSPath}>🔍 Auto-Detect</button>
      </div>
      <p class="hint">Where scripts will be installed. Common locations:</p>
      <div class="path-suggestions" id="pathSuggestions"></div>
      
      <div class="row" style="margin-top:12px">
        <button on:click={() => handleGoToInstallStep(2)} class="btn-primary">
          Next: Select Scripts →
        </button>
      </div>
    </div>
    
    <!-- Step 2: Select Scripts -->
    <div id="installStep2" class="install-step">
      <h4>Step 2: Select Scripts to Install</h4>
      
      <div id="installScriptsList" class="install-scripts-list"></div>
      
      <div class="row" style="margin-top:12px">
        <button on:click={() => handleGoToInstallStep(1)}>← Back</button>
        <button on:click={() => handleGoToInstallStep(3)} class="btn-primary">
          Next: Review →
        </button>
      </div>
    </div>
    
    <!-- Step 3: Review & Install -->
    <div id="installStep3" class="install-step">
      <h4>Step 3: Review & Install</h4>
      
      <div id="installReview" class="install-review"></div>
      
      <div class="install-method-select" style="margin-top:12px">
        <label>Installation Method</label>
        <select id="installMethod">
          <option value="powershell">PowerShell Script (Windows)</option>
          <option value="batch">Batch File (Windows)</option>
          <option value="bash">Bash Script (Linux/Mac)</option>
          <option value="manual">Manual Instructions</option>
        </select>
      </div>
      
      <div class="row" style="margin-top:12px">
        <button on:click={() => handleGoToInstallStep(2)}>← Back</button>
        <button on:click={handleGenerateInstallScript} class="btn-primary">
          Generate Install Script
        </button>
      </div>
    </div>
    
    <!-- Step 4: Execute/Copy Script -->
    <div id="installStep4" class="install-step">
      <h4>Step 4: Run Installation</h4>
      
      <div id="installScriptOutput" class="install-script-output"></div>
      
      <div class="row" style="margin-top:12px">
        <button on:click={() => handleGoToInstallStep(3)}>← Back</button>
        <button on:click={handleCopyInstallScript} class="btn-primary">
          📋 Copy Script
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .install-page {
    max-width: 1200px;
    margin: 0 auto;
    
    .install-step {
      display: none;
      
      &.active {
        display: block;
      }
    }
    
    .url-box {
      display: flex;
      gap: 8px;
      
      input {
        flex: 1;
      }
    }
    
    .row {
      display: flex;
      gap: 12px;
    }
    
    .path-suggestions {
      margin-top: 8px;
      padding: 8px;
      background: var(--bg-dark);
      border-radius: 4px;
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    
    .install-scripts-list {
      margin: 16px 0;
    }
    
    .install-review {
      padding: 16px;
      background: var(--bg-dark);
      border-radius: 6px;
      margin: 16px 0;
    }
    
    .install-script-output {
      padding: 16px;
      background: var(--bg-dark);
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9em;
      white-space: pre-wrap;
      max-height: 400px;
      overflow-y: auto;
    }
  }
</style>
