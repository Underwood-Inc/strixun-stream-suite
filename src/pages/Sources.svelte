<script lang="ts">
  /**
   * Sources Page
   * 
   * Source management and visibility controls
   */
  
  import { onMount } from 'svelte';
  import { connected, currentScene, sources } from '../stores/connection';
  import { SearchBox, SourceSelect } from '@components';
  import { stagger } from '../core/animations';
  
  let visAnimType = 'fade';
  let visAnimDuration = 300;
  let visAnimEasing = 'easeOut';
  let opacitySource = '';
  let opacityValue = 100;
  let selectedScene = '';
  
  onMount(() => {
    // Load saved animation settings
    const savedAnimType = (window as any).App?.storage?.getRaw('visAnimType');
    const savedAnimDuration = (window as any).App?.storage?.getRaw('visAnimDuration');
    const savedAnimEasing = (window as any).App?.storage?.getRaw('visAnimEasing');
    
    if (savedAnimType) visAnimType = savedAnimType;
    if (savedAnimDuration) visAnimDuration = Number(savedAnimDuration);
    if (savedAnimEasing) visAnimEasing = savedAnimEasing;
    
    // Render scenes and sources
    if ($connected) {
      (window as any).Sources?.refreshScenes();
      (window as any).Sources?.refreshSources();
    }
  });
  
  $: {
    if ($connected && $currentScene) {
      selectedScene = $currentScene;
      (window as any).Sources?.refreshSources();
    }
  }
  
  function handleVisAnimChange(): void {
    if ((window as any).App?.storage) {
      (window as any).App.storage.setRaw('visAnimType', visAnimType);
      (window as any).App.storage.setRaw('visAnimDuration', visAnimDuration);
      (window as any).App.storage.setRaw('visAnimEasing', visAnimEasing);
    }
  }
  
  function handleOpacityChange(): void {
    // Opacity value is reactive, no DOM manipulation needed
    // The {opacityValue}% display updates automatically via Svelte reactivity
  }
  
  function handleApplyOpacity(): void {
    if (opacitySource) {
      (window as any).Sources?.applySourceOpacity(opacitySource, opacityValue);
    }
  }
  
  function handleResetOpacity(): void {
    if (opacitySource) {
      opacityValue = 100;
      (window as any).Sources?.applySourceOpacity(opacitySource, 100);
    }
  }
  
  function handleLoadOpacity(): void {
    if (opacitySource && (window as any).Sources?.loadSourceOpacity) {
      const savedOpacity = (window as any).Sources.loadSourceOpacity(opacitySource);
      opacityValue = savedOpacity;
    } else {
      opacityValue = 100;
    }
  }
  
  // Watch for source changes and load opacity
  $: {
    if (opacitySource && $connected) {
      handleLoadOpacity();
    } else if (!opacitySource) {
      opacityValue = 100;
    }
  }
  
  function handleRefreshSceneList(): void {
    (window as any).Sources?.refreshSceneList();
  }
</script>

<div class="page sources-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <!-- Visibility Animation -->
  <div class="card">
    <h3>Visibility Animation</h3>
    <label>Animation Type</label>
    <select id="visAnimType" bind:value={visAnimType} on:change={handleVisAnimChange}>
      <option value="none">None (instant)</option>
      <option value="fade" selected>Fade</option>
      <option value="slide_left">Slide Left</option>
      <option value="slide_right">Slide Right</option>
      <option value="slide_up">Slide Up</option>
      <option value="slide_down">Slide Down</option>
      <option value="zoom">Zoom</option>
      <option value="pop">Pop (overshoot)</option>
    </select>
    <div class="row" style="margin-top:8px">
      <div>
        <label>Duration (ms)</label>
        <input type="number" id="visAnimDuration" bind:value={visAnimDuration} min="50" max="2000" step="50" on:change={handleVisAnimChange}>
      </div>
      <div>
        <label>Easing</label>
        <select id="visAnimEasing" bind:value={visAnimEasing} on:change={handleVisAnimChange}>
          <option value="ease">Ease</option>
          <option value="linear">Linear</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut" selected>Ease Out</option>
          <option value="bounce">Bounce</option>
        </select>
      </div>
    </div>
  </div>
  
  <!-- Opacity Control -->
  <div class="card">
    <h3> Opacity Control</h3>
    <label>Source</label>
    <SourceSelect
      bind:value={opacitySource}
      placeholder="-- Select Source --"
      searchable={true}
      disabled={!$connected}
      on:change={handleLoadOpacity}
    />
    <div style="margin-top:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <input type="range" id="opacitySlider" class="opacity-slider" 
               min="0" max="100" bind:value={opacityValue}
               on:input={handleOpacityChange}>
        <span id="opacityValue" style="font-weight:700;font-size:1.4em;min-width:55px;text-align:right;color:var(--accent)">
          {opacityValue}%
        </span>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button on:click={handleApplyOpacity} style="flex:1">✓ Apply</button>
      <button on:click={handleResetOpacity} class="btn-secondary" style="flex:1">→ Reset to 100%</button>
    </div>
    <p class="hint" style="margin-top:8px;font-size:0.75em;color:var(--muted)"> ★ Setting to 100% removes the filter (no overhead)
    </p>
  </div>
  
  <!-- Scene Browser -->
  <div class="card">
    <h3> Scenes</h3>
    <SearchBox
      inputId="scenesSearchInput"
      placeholder="Search scenes..."
      containerId="scenesList"
      itemSelector=".source-item, .config-item"
      textSelector=".name, h3, h4"
      minChars={1}
      debounceMs={150}
      showCount={true}
    />
      <div id="scenesList" class="config-list" style="max-height:200px;overflow-y:auto"></div>
    <button on:click={handleRefreshSceneList} class="btn-secondary" style="width:100%;margin-top:8px">
       Refresh Scenes
    </button>
  </div>
  
  <!-- Source Browser -->
  <div class="card">
    <h3> ★ Sources</h3>
    <p class="hint" id="sourcesSceneLabel" style="margin-bottom:8px">
      {#if $currentScene}
        Scene: {$currentScene}
      {:else}
        Select a scene above to view sources
      {/if}
    </p>
    <SearchBox
      inputId="sourcesSearchInput"
      placeholder="Search sources..."
      containerId="sourcesList"
      itemSelector=".source-item"
      textSelector=".name"
      minChars={1}
      debounceMs={150}
      showCount={true}
    />
    <div id="sourcesList"></div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  @use '@styles/components/sources';
  
  .sources-page {
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
