<script lang="ts">
  /**
   * Swaps Page
   * 
   * Source swap configuration and management
   */
  
  import { onMount } from 'svelte';
  import { connected } from '../stores/connection';
  import { UIUtils } from '../modules/ui-utils';
  
  let swapSourceA = '';
  let swapSourceB = '';
  let swapStyle = 'slide';
  let swapDuration = 400;
  let swapEasing = 'ease';
  let swapPreserveAspect = true;
  let swapTempOverride = 'off';
  let swapDebugLogging = false;
  let swapConfigName = '';
  let swapNewSourceA = '';
  let swapNewSourceB = '';
  
  onMount(() => {
    // Initialize search for swap configs
    const swapsContainer = document.getElementById('savedSwaps');
    if (swapsContainer) {
      UIUtils.initSearchForList('savedSwaps', 'swapConfigsSearchInput', swapsContainer, 0);
    }
    
    // Load saved swap configs
    if ($connected) {
      (window as any).SourceSwaps?.loadConfigs();
      (window as any).SourceSwaps?.renderSavedSwaps();
      (window as any).SourceSwaps?.refreshSwapSources();
    }
  });
  
  $: {
    if ($connected) {
      (window as any).SourceSwaps?.refreshSwapSources();
    }
  }
  
  function handleExecuteSwap(): void {
    if ((window as any).executeSwap) {
      (window as any).executeSwap();
    }
  }
  
  function handleAddSwapConfig(): void {
    if ((window as any).addSwapConfig) {
      (window as any).addSwapConfig();
    }
  }
  
  function handleRefreshSwapSources(): void {
    if ((window as any).refreshSwapSources) {
      (window as any).refreshSwapSources();
    }
  }
  
  function handleExportConfigs(): void {
    if ((window as any).exportConfigs) {
      (window as any).exportConfigs();
    }
  }
  
  function handleImportConfigs(): void {
    if ((window as any).importConfigs) {
      (window as any).importConfigs();
    }
  }
</script>

<div class="page swaps-page">
  <!-- Quick Swap -->
  <div class="card">
    <h3>Quick Swap</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.85em">
      Select two sources and swap their position/size
    </p>
    <label>Source A</label>
    <select id="swapSourceA" bind:value={swapSourceA}></select>
    <label>Source B</label>
    <select id="swapSourceB" bind:value={swapSourceB}></select>
    <div class="row" style="margin-top:8px">
      <button class="btn-primary btn-lg" on:click={handleExecuteSwap} disabled={!$connected}>
        🔄 Swap Now
      </button>
    </div>
  </div>
  
  <!-- Animation -->
  <div class="card">
    <h3>Animation</h3>
    <label>Style</label>
    <select id="swapStyle" bind:value={swapStyle}>
      <option value="slide" selected>Slide (smooth move)</option>
      <option value="teleport">Teleport (instant)</option>
      <option value="scale">Scale (shrink/grow)</option>
      <option value="bounce">Bounce (overshoot)</option>
      <option value="elastic">Elastic (springy)</option>
      <option value="arc">Arc (curved path)</option>
    </select>
    <div class="row">
      <div>
        <label>Duration (ms)</label>
        <input type="number" id="swapDuration" bind:value={swapDuration} min="0" max="3000" step="50">
      </div>
      <div>
        <label>Easing</label>
        <select id="swapEasing" bind:value={swapEasing}>
          <option value="linear">Linear</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
          <option value="ease" selected>Ease In-Out</option>
          <option value="back">Back (overshoot)</option>
        </select>
      </div>
    </div>
    
    <div style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="swapPreserveAspect" bind:checked={swapPreserveAspect}>
        <span>Preserve Aspect Ratio (default)</span>
      </label>
    </div>
    
    <div style="margin-top:8px">
      <label>⚡ Temporary Override</label>
      <select id="swapTempOverride" bind:value={swapTempOverride}>
        <option value="off" selected>Off (use config/global)</option>
        <option value="preserve">Preserve</option>
        <option value="stretch">Stretch</option>
      </select>
      <p style="font-size:0.75em;color:var(--muted);margin:4px 0 0">
        Force Preserve or Stretch for ALL swaps until set back to Off
      </p>
    </div>
    
    <div style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="swapDebugLogging" bind:checked={swapDebugLogging}>
        <span>Debug Logging</span>
      </label>
    </div>
  </div>
  
  <!-- Add Swap Config -->
  <div class="card">
    <h3>Add Swap Config</h3>
    <label>Config Name</label>
    <input type="text" id="swapConfigName" bind:value={swapConfigName} placeholder="e.g. Camera ↔ Gameplay">
    <div class="row" style="margin-top:8px">
      <div style="flex:1">
        <label>Source A</label>
        <select id="swapNewSourceA" bind:value={swapNewSourceA}></select>
      </div>
      <div style="flex:1">
        <label>Source B</label>
        <select id="swapNewSourceB" bind:value={swapNewSourceB}></select>
      </div>
    </div>
    <button class="btn-primary" style="margin-top:12px;width:100%" on:click={handleAddSwapConfig} disabled={!$connected}>
      ➕ Add Config
    </button>
  </div>
  
  <!-- Saved Configs -->
  <div class="card">
    <h3>Saved Configs</h3>
    <div class="search-box">
      <input type="text" class="search-box__input" id="swapConfigsSearchInput" placeholder="Search configs...">
      <span class="search-box__icon">🔍</span>
      <button class="search-box__clear" title="Clear">✕</button>
    </div>
    <div id="savedSwaps"></div>
    <div class="row" style="margin-top:8px">
      <button on:click={handleRefreshSwapSources} disabled={!$connected}>🔄 Refresh Sources</button>
      <button on:click={handleExportConfigs}>📤 Export</button>
      <button on:click={handleImportConfigs}>📥 Import</button>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .swaps-page {
    max-width: 1200px;
    margin: 0 auto;
    
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  }
</style>
