<script lang="ts">
  /**
   * Text Cycler Page
   * 
   * Text cycler configuration and management
   */
  
  import { onMount } from 'svelte';
  import { connected, textSources } from '../stores/connection';
  import { SearchBox, Tooltip, SourceSelect } from '@components';
  import { stagger } from '../core/animations';
  
  let showEditor = false;
  let showTextLines = false;
  let showAnimation = false;
  let showStyle = false;
  let showPreview = false;
  let showControls = false;
  
  let configsContainer: HTMLDivElement;
  
  onMount(() => {
    // Load saved configs and render
    (window as any).TextCycler?.loadConfigs();
    (window as any).TextCycler?.renderTextCyclerConfigs();
  });
  
  $: {
    // Re-render configs when connection state changes
    if ($connected) {
      (window as any).TextCycler?.renderTextCyclerConfigs();
    }
  }
  
  function handleNewConfig(): void {
    if ((window as any).newTextConfig) {
      (window as any).newTextConfig();
    }
  }
  
  function handleExportConfigs(): void {
    if ((window as any).exportTextConfigs) {
      (window as any).exportTextConfigs();
    }
  }
  
  function handleImportConfigs(): void {
    if ((window as any).importTextConfigs) {
      (window as any).importTextConfigs();
    }
  }
  
  function handleStartCycler(): void {
    if ((window as any).startTextCycler) {
      (window as any).startTextCycler();
    }
  }
  
  function handleStopCycler(): void {
    if ((window as any).stopTextCycler) {
      (window as any).stopTextCycler();
    }
  }
  
  function handleSaveConfig(): void {
    if ((window as any).saveCurrentTextConfig) {
      (window as any).saveCurrentTextConfig();
    }
  }
  
  function handleDeleteConfig(): void {
    if ((window as any).deleteCurrentTextConfig) {
      (window as any).deleteCurrentTextConfig();
    }
  }
  
  function handleUpdateTextCyclerMode(): void {
    if ((window as any).updateTextCyclerMode) {
      (window as any).updateTextCyclerMode();
    }
  }
  
  function handleUpdateBrowserSourceUrlPreview(): void {
    if ((window as any).updateBrowserSourceUrlPreview) {
      (window as any).updateBrowserSourceUrlPreview();
    }
  }
  
  function handleCopyBrowserSourceUrl(): void {
    if ((window as any).copyBrowserSourceUrl) {
      (window as any).copyBrowserSourceUrl();
    }
  }
  
  function handleLoadTextSource(): void {
    if (textSource && (window as any).loadTextSource) {
      // Pass the reactive value instead of reading from DOM
      const selectEl = document.getElementById('textSource') as HTMLSelectElement;
      if (selectEl) {
        selectEl.value = textSource;
      }
      (window as any).loadTextSource();
    }
  }
  
  function handleUpdateTransitionMode(): void {
    if ((window as any).updateTransitionMode) {
      (window as any).updateTransitionMode();
    }
  }
</script>

<div class="page text-cycler-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <!-- Saved Configs -->
  <div class="card">
    <h3> Saved Configs</h3>
    <SearchBox
      inputId="textConfigsSearchInput"
      placeholder="Search configs..."
      containerId="textCyclerConfigs"
      itemSelector=".config-item"
      textSelector=".name, h3, h4"
      minChars={1}
      debounceMs={150}
      showCount={true}
    />
    <div id="textCyclerConfigs" class="config-list" bind:this={configsContainer}></div>
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Create a new text cycler configuration' : 'Connect to OBS first to create configs'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleNewConfig} disabled={!$connected}>⊕ New Config</button>
      </Tooltip>
      <button on:click={handleExportConfigs}> Export</button>
      <button on:click={handleImportConfigs}> Import</button>
    </div>
  </div>

  <!-- Config Editor -->
  <div class="card" id="textConfigEditor" style="display:none">
    <h3> Edit Config</h3>
    <label>Config Name</label>
    <input type="text" id="textConfigName" placeholder="My Text Cycler">
    
    <label>Mode</label>
    <select id="textCyclerMode" on:change={handleUpdateTextCyclerMode}>
      <option value="browser">Browser Source (smooth CSS animations)</option>
      <option value="legacy">Legacy (OBS text source)</option>
    </select>
    <p id="modeInfo" style="font-size:0.75em;color:var(--muted);margin:4px 0 8px"></p>
    
    <div id="browserModeSettings">
      <label>Config ID (for browser source URL)</label>
      <div class="url-box">
        <input type="text" id="textConfigId" placeholder="config1" style="flex:1" on:input={handleUpdateBrowserSourceUrlPreview}>
        <button on:click={handleCopyBrowserSourceUrl}>✓ Copy URL</button>
      </div>
      <p style="font-size:0.7em;color:var(--muted);margin-top:4px">
        Add as OBS Browser Source: <code id="browserSourceUrlPreview"></code>
      </p>
    </div>
    
    <div id="legacyModeSettings" style="display:none">
      <label>Text Source</label>
      <SourceSelect
        id="textSource"
        placeholder="-- Select Text Source --"
        searchable={true}
        disabled={!$connected}
        filter={(source) => 
          source.inputKind && (
            source.inputKind.includes('text') || 
            source.inputKind === 'text_gdiplus_v2' || 
            source.inputKind === 'text_ft2_source_v2'
          )
        }
        on:change={handleLoadTextSource}
      />
    </div>
  </div>

  <!-- Text Lines -->
  <div class="card" id="textLinesCard" style="display:none">
    <h3> ★ Text Lines</h3>
    <textarea id="textLines" placeholder="Enter text lines (one per line)&#10;Line 1&#10;Line 2&#10;Line 3" rows="5"></textarea>
  </div>
  
  <!-- Animation Settings -->
  <div class="card" id="textAnimationCard" style="display:none">
    <h3> Animation</h3>
    <label>Transition Effect</label>
    <select id="textTransition" on:change={handleUpdateTransitionMode}>
      <option value="none">None (instant)</option>
      <option value="fade">Fade</option>
      <option value="obfuscate">Obfuscate (Minecraft enchant)</option>
      <option value="typewriter">Typewriter</option>
      <option value="glitch">Glitch</option>
      <option value="scramble">Scramble  Snap</option>
      <option value="wave">Wave Reveal</option>
      <option value="slide_left">Slide Left</option>
      <option value="slide_right">Slide Right</option>
      <option value="slide_up">Slide Up</option>
      <option value="slide_down">Slide Down</option>
      <option value="pop">Pop</option>
    </select>
    <p id="transitionInfo" style="font-size:0.75em;color:var(--muted);margin:4px 0 12px"></p>
    <div class="row">
      <div>
        <label>Transition (ms)</label>
        <input type="number" id="transDuration" value="500" min="100" max="3000" step="50">
      </div>
      <div>
        <label>Cycle (ms)</label>
        <input type="number" id="textDuration" value="3000" min="500" step="100">
      </div>
    </div>
  </div>

  <!-- Style Settings (Browser Mode Only) -->
  <div class="card" id="textStyleCard" style="display:none">
    <h3> ★ Style (Browser Mode)</h3>
    
    <label>Font Family</label>
    <select id="textFontFamily">
      <option value="'Segoe UI', system-ui, sans-serif">Segoe UI (Default)</option>
      <option value="Arial, sans-serif">Arial</option>
      <option value="'Helvetica Neue', Helvetica, sans-serif">Helvetica</option>
      <option value="Georgia, serif">Georgia</option>
      <option value="'Times New Roman', serif">Times New Roman</option>
      <option value="'Courier New', monospace">Courier New</option>
      <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
      <option value="Verdana, sans-serif">Verdana</option>
      <option value="Impact, sans-serif">Impact</option>
      <option value="'Comic Sans MS', cursive">Comic Sans</option>
    </select>
    <input type="text" id="textFontFamilyCustom" placeholder="Or enter custom font: 'Font Name', fallback" style="margin-top:4px">
    
    <div class="row" style="margin-top:12px">
      <div>
        <label>Font Size</label>
        <input type="text" id="textFontSize" value="48px" placeholder="48px">
      </div>
      <div>
        <label>Font Weight</label>
        <select id="textFontWeight">
          <option value="100">Thin</option>
          <option value="300">Light</option>
          <option value="400">Normal</option>
          <option value="500">Medium</option>
          <option value="600">Semi-Bold</option>
          <option value="700" selected>Bold</option>
          <option value="800">Extra Bold</option>
          <option value="900">Black</option>
        </select>
      </div>
    </div>
    
    <div class="row">
      <div>
        <label>Text Color</label>
        <div style="display:flex;gap:4px">
          <input type="color" id="textColorPicker" value="#ffffff" style="width:40px;height:32px;padding:0;border:none;cursor:pointer">
          <input type="text" id="textColor" value="#ffffff" placeholder="#ffffff" style="flex:1">
        </div>
      </div>
      <div>
        <label>Text Align</label>
        <select id="textAlign">
          <option value="center" selected>Center</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
    </div>
    
    <div class="row">
      <div>
        <label>Letter Spacing</label>
        <input type="text" id="textLetterSpacing" value="normal" placeholder="normal, 2px, 0.1em">
      </div>
      <div>
        <label>Line Height</label>
        <input type="text" id="textLineHeight" value="1.2" placeholder="1.2, 1.5, 2">
      </div>
    </div>
    
    <div class="row">
      <div>
        <label>Text Transform</label>
        <select id="textTransform">
          <option value="none" selected>None</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </div>
      <div>
        <label>Font Style</label>
        <select id="textFontStyle">
          <option value="normal" selected>Normal</option>
          <option value="italic">Italic</option>
        </select>
      </div>
    </div>
    
    <label>Text Shadow</label>
    <input type="text" id="textShadow" value="2px 2px 4px rgba(0,0,0,0.5)" placeholder="2px 2px 4px rgba(0,0,0,0.5)">
    
    <label style="margin-top:8px">Text Stroke (Outline)</label>
    <div class="row">
      <div>
        <input type="text" id="textStrokeWidth" value="0" placeholder="Width: 0, 1px, 2px">
      </div>
      <div>
        <div style="display:flex;gap:4px">
          <input type="color" id="textStrokeColorPicker" value="#000000" style="width:40px;height:32px;padding:0;border:none;cursor:pointer">
          <input type="text" id="textStrokeColor" value="#000000" placeholder="#000000" style="flex:1">
        </div>
      </div>
    </div>
  </div>

  <!-- Preview -->
  <div class="card" id="textPreviewCard" style="display:none">
    <h3> Preview</h3>
    <div class="text-preview" id="textPreview">Select or create a config</div>
  </div>
  
  <!-- Controls -->
  <div id="textControls" style="display:none">
    <div class="row">
      <Tooltip 
        text={$connected ? 'Start cycling through text items' : 'Connect to OBS first to start text cycling'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button class="btn-success btn-lg" id="startCycleBtn" on:click={handleStartCycler} disabled={!$connected}>
          ▶ Start
        </button>
      </Tooltip>
      <Tooltip 
        text={$connected ? 'Stop text cycling' : 'Connect to OBS first to control text cycling'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button class="btn-danger btn-lg" id="stopCycleBtn" on:click={handleStopCycler} disabled={!$connected}>
          ■ Stop
        </button>
      </Tooltip>
    </div>
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Save current configuration' : 'Connect to OBS first to save configs'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleSaveConfig} disabled={!$connected}> Save Config</button>
      </Tooltip>
      <Tooltip 
        text={$connected ? 'Delete current configuration' : 'Connect to OBS first to delete configs'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleDeleteConfig} style="background:var(--danger);border-color:var(--danger)" disabled={!$connected}> ★ ️ Delete
        </button>
      </Tooltip>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/forms';
  
  .text-cycler-page {
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
    }
    
    .text-preview {
      padding: 40px;
      background: var(--bg-dark);
      border-radius: 6px;
      text-align: center;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2em;
      color: var(--text);
    }
  }
</style>
