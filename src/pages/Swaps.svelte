<script lang="ts">
  /**
   * Swaps Page
   * 
   * Source swap configuration and management
   */
  
  import { onMount } from 'svelte';
  import { connected, sources } from '../stores/connection';
  import { SearchBox, Tooltip, SourceSelect } from '@components';
  import { stagger } from '../core/animations';
  
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
  
  let swapsContainer: HTMLDivElement;
  
  onMount(() => {
    // Load saved swap configs
    if ($connected) {
      (window as any).SourceSwaps?.loadConfigs();
      (window as any).SourceSwaps?.renderSavedSwaps();
    }
  });
  
  // Reactive: re-render when sources change
  $: {
    if ($connected && $sources && $sources.length > 0) {
      (window as any).SourceSwaps?.renderSavedSwaps();
    }
  }
  
  function handleExecuteSwap(): void {
    if ((window as any).executeSwap) {
      // Pass reactive values directly instead of reading from DOM
      (window as any).executeSwap(swapSourceA, swapSourceB);
    }
  }
  
  function handleAddSwapConfig(): void {
    if ((window as any).addSwapConfig) {
      // Pass reactive values directly instead of reading from DOM
      (window as any).addSwapConfig(swapConfigName, swapNewSourceA, swapNewSourceB, {
        style: swapStyle,
        duration: swapDuration,
        easing: swapEasing,
        preserveAspect: swapPreserveAspect
      });
    }
  }
  
  function handleRefreshSwapSources(): void {
    // Sources are reactive, just refresh from OBS
    if ((window as any).Sources?.refreshSources) {
      (window as any).Sources.refreshSources();
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

<div class="page swaps-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <!-- Quick Swap -->
  <div class="card">
    <h3>Quick Swap</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.85em">
      Select two sources and swap their position/size
    </p>
    <label>Source A</label>
    <SourceSelect
      bind:value={swapSourceA}
      placeholder="-- Select Source --"
      searchable={true}
      disabled={!$connected}
    />
    <label>Source B</label>
    <SourceSelect
      bind:value={swapSourceB}
      placeholder="-- Select Source --"
      searchable={true}
      disabled={!$connected}
    />
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Execute the swap between selected sources' : 'Connect to OBS first to execute swaps'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button class="btn-primary btn-lg" on:click={handleExecuteSwap} disabled={!$connected}>
          🔄 Swap Now
        </button>
      </Tooltip>
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
        <SourceSelect
          bind:value={swapNewSourceA}
          placeholder="-- Select Source --"
          searchable={true}
          disabled={!$connected}
        />
      </div>
      <div style="flex:1">
        <label>Source B</label>
        <SourceSelect
          bind:value={swapNewSourceB}
          placeholder="-- Select Source --"
          searchable={true}
          disabled={!$connected}
        />
      </div>
    </div>
    <Tooltip 
      text={$connected ? 'Save current swap settings as a reusable config' : 'Connect to OBS first to save swap configs'} 
      position="bottom"
      level={$connected ? 'log' : 'warning'}
    >
      <button class="btn-primary" style="margin-top:12px;width:100%" on:click={handleAddSwapConfig} disabled={!$connected}>
        ➕ Add Config
      </button>
    </Tooltip>
  </div>
  
  <!-- Saved Configs -->
  <div class="card">
    <h3>Saved Configs</h3>
    <SearchBox
      inputId="swapConfigsSearchInput"
      placeholder="Search configs..."
      containerId="savedSwaps"
      itemSelector=".config-item"
      textSelector=".name, h3, h4"
      minChars={1}
      debounceMs={150}
      showCount={true}
    />
    <div id="savedSwaps" bind:this={swapsContainer}></div>
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Refresh source list from OBS' : 'Connect to OBS first to refresh sources'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleRefreshSwapSources} disabled={!$connected}>🔄 Refresh Sources</button>
      </Tooltip>
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
