<script lang="ts">
  /**
   * Layouts Page
   * 
   * Layout preset management
   */
  
  import { onMount } from 'svelte';
  import { SearchBox, Tooltip } from '@components';
  import { connected, currentScene } from '../stores/connection';
  import { stagger } from '../core/animations';
  
  let layoutName = '';
  let layoutDuration = 500;
  let layoutEasing = 'ease_out';
  let layoutStagger = 0;
  let layoutApplyVisibility = true;
  
  onMount(() => {
    // Load saved layouts
    if ($connected && $currentScene) {
      (window as any).Layouts?.refreshLayouts();
      (window as any).Layouts?.renderSavedLayouts();
    }
  });
  
  $: {
    // Refresh and render layouts when scene changes
    if ($connected && $currentScene) {
      (window as any).Layouts?.refreshLayouts();
      (window as any).Layouts?.renderSavedLayouts();
    }
  }
  
  function handleCaptureLayout(): void {
    if ((window as any).Layouts?.captureLayout) {
      (window as any).Layouts.captureLayout();
    }
  }
  
  function handleRefreshLayouts(): void {
    if ((window as any).Layouts?.refreshLayouts) {
      (window as any).Layouts.refreshLayouts();
    }
  }
</script>

<div class="page layouts-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <!-- Save Current Layout -->
  <div class="card">
    <h3> Save Current Layout</h3>
    <p style="color:var(--muted);margin-bottom:12px;font-size:0.85em">
      Capture all source positions/sizes in current scene
    </p>
    <label>Layout Name</label>
    <input type="text" id="layoutName" bind:value={layoutName} placeholder="e.g. Gaming Layout, Just Chatting">
    <Tooltip 
      text={$connected ? 'Save current scene source positions and sizes as a layout' : 'Connect to OBS first to capture layouts'} 
      position="bottom"
      level={$connected ? 'log' : 'warning'}
    >
      <button class="btn-primary" style="margin-top:12px;width:100%" on:click={handleCaptureLayout} disabled={!$connected}>
         Capture Current Layout
      </button>
    </Tooltip>
  </div>
  
  <!-- Saved Layouts -->
  <div class="card">
    <h3> Saved Layouts</h3>
    <p style="color:var(--muted);margin-bottom:8px;font-size:0.85em" id="layoutSceneInfo">
      Scene: <span id="layoutCurrentScene">{$currentScene || '-'}</span>
    </p>
    <SearchBox
      inputId="layoutSearchInput"
      placeholder="Search layouts..."
      containerId="savedLayouts"
      itemSelector=".config-item"
      textSelector=".name, h3, h4"
      minChars={1}
      debounceMs={150}
      showCount={true}
    />
    <div id="savedLayouts" class="config-list"></div>
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Refresh saved layouts list' : 'Connect to OBS first to refresh layouts'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleRefreshLayouts} disabled={!$connected}>[EMOJI] Refresh</button>
      </Tooltip>
    </div>
  </div>
  
  <!-- Animation Settings -->
  <div class="card">
    <h3>[SETTINGS] Animation Settings</h3>
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
    <h3>[INFO] How It Works</h3>
    <ol style="padding-left:20px;color:var(--muted);font-size:0.85em;margin:0">
      <li>Arrange sources how you want them</li>
      <li>Enter a name and click "Capture"</li>
      <li>Rearrange sources or change layouts</li>
      <li>Click "Apply" to animate back</li>
    </ol>
    <p style="color:var(--muted);font-size:0.8em;margin-top:8px">
      [EMOJI] <b>Tip:</b> Assign hotkeys in OBS  Settings  Hotkeys for quick switching!
    </p>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .layouts-page {
    max-width: 1200px;
    margin: 0 auto;
    
    > .card {
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  }
</style>
