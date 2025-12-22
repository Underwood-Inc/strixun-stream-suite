<script lang="ts">
  /**
   * Layouts Page
   * 
   * Layout preset management
   */
  
  import { onMount } from 'svelte';
  import { UIUtils } from '../modules/ui-utils';
  import { connected, currentScene } from '../stores/connection';
  
  let layoutName = '';
  let layoutDuration = 500;
  let layoutEasing = 'ease_out';
  let layoutStagger = 0;
  let layoutApplyVisibility = true;
  
  onMount(() => {
    // Initialize search for layouts
    const layoutsContainer = document.getElementById('savedLayouts');
    if (layoutsContainer) {
      UIUtils.initSearchForList('savedLayouts', 'layoutSearchInput', layoutsContainer, 0);
    }
    
    // Load saved layouts
    if ($connected) {
      (window as any).Layouts?.refreshLayouts();
    }
  });
  
  $: {
    if ($connected && $currentScene) {
      (window as any).Layouts?.refreshLayouts();
    }
  }
  
  function handleCaptureLayout(): void {
    if ((window as any).captureLayout) {
      (window as any).captureLayout();
    }
  }
  
  function handleRefreshLayouts(): void {
    if ((window as any).refreshLayouts) {
      (window as any).refreshLayouts();
    }
  }
</script>

<div class="page layouts-page">
  <!-- Save Current Layout -->
  <div class="card">
    <h3>💾 Save Current Layout</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.85em">
      Capture all source positions/sizes in current scene
    </p>
    <label>Layout Name</label>
    <input type="text" id="layoutName" bind:value={layoutName} placeholder="e.g. Gaming Layout, Just Chatting">
    <button class="btn-primary" style="margin-top:12px;width:100%" on:click={handleCaptureLayout} disabled={!$connected}>
      📸 Capture Current Layout
    </button>
  </div>
  
  <!-- Saved Layouts -->
  <div class="card">
    <h3>📂 Saved Layouts</h3>
    <p style="color:var(--muted);margin-bottom:8px;font-size:0.85em" id="layoutSceneInfo">
      Scene: <span id="layoutCurrentScene">{$currentScene || '-'}</span>
    </p>
    <div class="search-box">
      <input type="text" class="search-box__input" id="layoutSearchInput" placeholder="Search layouts...">
      <span class="search-box__icon">🔍</span>
      <button class="search-box__clear" title="Clear">✕</button>
    </div>
    <div id="savedLayouts" class="config-list"></div>
    <div class="row" style="margin-top:8px">
      <button on:click={handleRefreshLayouts} disabled={!$connected}>🔄 Refresh</button>
    </div>
  </div>
  
  <!-- Animation Settings -->
  <div class="card">
    <h3>⚙️ Animation Settings</h3>
    <div class="row">
      <div style="flex:1">
        <label>Duration (ms)</label>
        <input type="number" id="layoutDuration" bind:value={layoutDuration} min="100" max="2000" step="50">
      </div>
      <div style="flex:1">
        <label>Easing</label>
        <select id="layoutEasing" bind:value={layoutEasing}>
          <option value="ease_out" selected>Ease Out</option>
          <option value="ease_in_out">Ease In/Out</option>
          <option value="ease_in">Ease In</option>
          <option value="linear">Linear</option>
          <option value="bounce">Bounce</option>
          <option value="elastic">Elastic</option>
          <option value="back">Back</option>
        </select>
      </div>
    </div>
    <div style="margin-top:8px">
      <label>Stagger (ms)</label>
      <input type="number" id="layoutStagger" bind:value={layoutStagger} min="0" max="200" step="10">
      <p style="font-size:0.75em;color:var(--muted);margin:4px 0 0">
        Delay between each source animation (0 = all at once)
      </p>
    </div>
    <div style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="layoutApplyVisibility" bind:checked={layoutApplyVisibility}>
        <span>Apply visibility changes</span>
      </label>
    </div>
  </div>
  
  <!-- How It Works -->
  <div class="card">
    <h3>ℹ️ How It Works</h3>
    <ol style="padding-left:20px;color:var(--muted);font-size:0.85em;margin:0">
      <li>Arrange sources how you want them</li>
      <li>Enter a name and click "Capture"</li>
      <li>Rearrange sources or change layouts</li>
      <li>Click "Apply" to animate back</li>
    </ol>
    <p style="color:var(--muted);font-size:0.8em;margin-top:8px">
      💡 <b>Tip:</b> Assign hotkeys in OBS → Settings → Hotkeys for quick switching!
    </p>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .layouts-page {
    max-width: 1200px;
    margin: 0 auto;
    
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  }
</style>
