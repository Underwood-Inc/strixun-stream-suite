<script lang="ts">
  /**
   * Text Cycler Page
   * 
   * Properly migrated Svelte component using reactive stores.
   */
  
  import { connected } from '../stores/connection';
  import { showToast } from '../stores/toast-queue';
  import { Tooltip } from '@components';
  import { stagger } from '../core/animations';
  import TextCyclerDisplay from './TextCyclerDisplay.svelte';
  
  // Import the text cycler store
  import {
    configs,
    selectedIndex,
    selectedConfig,
    createConfig,
    selectConfig,
    updateSelectedConfig,
    updateSelectedStyles,
    deleteSelectedConfig,
    saveCurrentConfig,
    startCycler,
    stopCycler,
    toggleCycler,
    exportConfigs,
    importConfigs,
    getBrowserSourceUrl,
    copyBrowserSourceUrl,
    type TextCyclerConfig
  } from '../stores/text-cycler';
  
  // ============ Local Form State ============
  // These are bound to form inputs and synced to the store
  
  let configName = '';
  let configId = '';
  let mode: 'browser' | 'legacy' = 'browser';
  let textSource = '';
  let textLinesRaw = '';
  let transition = 'obfuscate';
  let transDuration = 500;
  let cycleDuration = 3000;
  
  // Style form state
  let fontFamily = "'Segoe UI', system-ui, sans-serif";
  let fontFamilyCustom = '';
  let fontSize = '48px';
  let fontWeight = '700';
  let fontStyle = 'normal';
  let color = '#ffffff';
  let textAlign = 'center';
  let letterSpacing = 'normal';
  let lineHeight = '1.2';
  let textTransform = 'none';
  let shadow = '2px 2px 4px rgba(0,0,0,0.5)';
  let strokeWidth = '0';
  let strokeColor = '#000000';
  
  // ============ Reactive Updates ============
  
  // Track which config is loaded to prevent re-loading on every store update
  let loadedConfigIndex = -1;
  
  // Only load form when selection CHANGES, not when config content changes
  $: if ($selectedIndex !== loadedConfigIndex && $selectedConfig) {
    loadedConfigIndex = $selectedIndex;
    loadConfigToForm($selectedConfig);
  }
  
  function loadConfigToForm(config: TextCyclerConfig): void {
    configName = config.name;
    configId = config.configId;
    mode = config.mode;
    textSource = config.textSource;
    textLinesRaw = config.textLines.join('\n');
    transition = config.transition;
    transDuration = config.transDuration;
    cycleDuration = config.cycleDuration;
    
    // Styles
    const s = config.styles || {};
    fontFamily = s.fontFamily || "'Segoe UI', system-ui, sans-serif";
    fontSize = s.fontSize || '48px';
    fontWeight = s.fontWeight || '700';
    fontStyle = s.fontStyle || 'normal';
    color = s.color || '#ffffff';
    textAlign = s.textAlign || 'center';
    letterSpacing = s.letterSpacing || 'normal';
    lineHeight = s.lineHeight || '1.2';
    textTransform = s.textTransform || 'none';
    shadow = s.shadow || '';
    strokeWidth = s.strokeWidth || '0';
    strokeColor = s.strokeColor || '#000000';
  }
  
  // Sync form changes to store
  function syncToStore(): void {
    if ($selectedIndex < 0) return;
    
    const textLines = textLinesRaw.split('\n').map(l => l.trim()).filter(l => l);
    
    updateSelectedConfig({
      name: configName,
      configId,
      mode,
      textSource,
      textLines,
      transition,
      transDuration,
      cycleDuration
    });
    
    updateSelectedStyles({
      fontFamily: fontFamilyCustom || fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      color,
      textAlign,
      letterSpacing,
      lineHeight,
      textTransform,
      shadow,
      strokeWidth,
      strokeColor
    });
  }
  
  // ============ Handlers ============
  
  function handleSelectConfig(index: number): void {
    selectConfig(index);
  }
  
  function handleNewConfig(): void {
    createConfig();
  }
  
  async function handleExportConfigs(): Promise<void> {
    const success = await exportConfigs();
    if (success) {
      showToast({ message: 'Configs copied to clipboard!', type: 'success' });
    } else {
      showToast({ message: 'No configs to export', type: 'error' });
    }
  }
  
  async function handleImportConfigs(): Promise<void> {
    const count = await importConfigs();
    if (count > 0) {
      showToast({ message: `Imported ${count} configs`, type: 'success' });
    } else {
      showToast({ message: 'Failed to import configs', type: 'error' });
    }
  }
  
  function handleSaveConfig(): void {
    syncToStore();
    saveCurrentConfig();
    showToast({ message: 'Config saved!', type: 'success' });
  }
  
  function handleDeleteConfig(): void {
    if (!confirm('Delete this config?')) return;
    deleteSelectedConfig();
    showToast({ message: 'Config deleted', type: 'info' });
  }
  
  function handleStartCycler(): void {
    syncToStore();
    startCycler();
  }
  
  function handleStopCycler(): void {
    stopCycler();
  }
  
  async function handleCopyUrl(): Promise<void> {
    const success = await copyBrowserSourceUrl(configId);
    if (success) {
      showToast({ message: 'URL copied!', type: 'success' });
    }
  }
  
  // Color picker sync
  function syncColorPicker(e: Event, target: 'color' | 'strokeColor'): void {
    const value = (e.target as HTMLInputElement).value;
    if (target === 'color') {
      color = value;
    } else {
      strokeColor = value;
    }
  }
  
  // Mode change handler
  function handleModeChange(): void {
    syncToStore();
  }
  
  // ============ Computed ============
  
  $: browserSourceUrl = getBrowserSourceUrl(configId || 'default');
  $: hasConfig = $selectedIndex >= 0;
  $: isRunning = $selectedConfig?.isRunning ?? false;
</script>

<div class="page text-cycler-page" use:stagger={{ preset: 'fadeIn', stagger: 80, config: { duration: 300 } }}>
  <!-- Saved Configs -->
  <div class="card">
    <h3>Saved Configs</h3>
    <div class="config-list">
      {#each $configs as config, i}
        <div 
          class="config-item" 
          class:selected={i === $selectedIndex}
          class:running={config.isRunning}
          role="button"
          tabindex="0"
          on:click={() => handleSelectConfig(i)}
          on:keypress={(e) => e.key === 'Enter' && handleSelectConfig(i)}
        >
          <span class="name">{config.name}</span>
          <span class="meta">{config.textLines?.length || 0} lines</span>
          {#if config.isRunning}
            <span class="status">▶</span>
          {/if}
          <button 
            class="quick-toggle"
            on:click|stopPropagation={() => toggleCycler(i)}
            title={config.isRunning ? 'Stop' : 'Start'}
          >
            {config.isRunning ? '■' : '▶'}
          </button>
        </div>
      {/each}
      {#if $configs.length === 0}
        <p class="empty">No configs yet. Create one to get started!</p>
      {/if}
    </div>
    <div class="row" style="margin-top:8px">
      <Tooltip 
        text={$connected ? 'Create a new text cycler configuration' : 'Connect to OBS first'} 
        position="bottom"
        level={$connected ? 'log' : 'warning'}
      >
        <button on:click={handleNewConfig} disabled={!$connected}>⊕ New Config</button>
      </Tooltip>
      <button on:click={handleExportConfigs}>Export</button>
      <button on:click={handleImportConfigs}>Import</button>
    </div>
  </div>

  {#if hasConfig}
    <!-- Config Editor -->
    <div class="card">
      <h3>Edit Config</h3>
      <label for="configName">Config Name</label>
      <input 
        id="configName"
        type="text" 
        bind:value={configName} 
        placeholder="My Text Cycler"
        on:blur={syncToStore}
      >
      
      <label for="mode">Mode</label>
      <select id="mode" bind:value={mode} on:change={handleModeChange}>
        <option value="browser">Browser Source (smooth CSS animations)</option>
        <option value="legacy">Legacy (OBS text source)</option>
      </select>
      <p class="hint">
        {#if mode === 'browser'}
          Use this URL as an OBS Browser Source for smooth CSS-powered text animations.
        {:else}
          Directly update an OBS text source. Requires OBS connection.
        {/if}
      </p>
      
      {#if mode === 'browser'}
        <label for="configId">Config ID (for browser source URL)</label>
        <div class="url-box">
          <input 
            id="configId"
            type="text" 
            bind:value={configId} 
            placeholder="config1"
            on:blur={syncToStore}
          >
          <button on:click={handleCopyUrl}>✓ Copy URL</button>
        </div>
        <p class="hint url-preview">
          Add as OBS Browser Source: <code>{browserSourceUrl}</code>
        </p>
      {/if}
    </div>

    <!-- Text Lines -->
    <div class="card">
      <h3>Text Lines</h3>
      <textarea 
        bind:value={textLinesRaw}
        placeholder="Enter text lines (one per line)&#10;Line 1&#10;Line 2&#10;Line 3" 
        rows="5"
        on:blur={syncToStore}
      ></textarea>
    </div>
    
    <!-- Animation Settings -->
    <div class="card">
      <h3>Animation</h3>
      <label for="transition">Transition Effect</label>
      <select id="transition" bind:value={transition} on:change={syncToStore}>
        <option value="none">None (instant)</option>
        <option value="fade">Fade</option>
        <option value="obfuscate">Obfuscate (Minecraft enchant)</option>
        <option value="typewriter">Typewriter</option>
        <option value="glitch">Glitch</option>
        <option value="scramble">Scramble Snap</option>
        <option value="wave">Wave Reveal</option>
        <option value="slide_left">Slide Left</option>
        <option value="slide_right">Slide Right</option>
        <option value="slide_up">Slide Up</option>
        <option value="slide_down">Slide Down</option>
        <option value="pop">Pop</option>
      </select>
      <div class="row">
        <div>
          <label for="transDuration">Transition (ms)</label>
          <input 
            id="transDuration"
            type="number" 
            bind:value={transDuration} 
            min="100" 
            max="3000" 
            step="50"
            on:blur={syncToStore}
          >
        </div>
        <div>
          <label for="cycleDuration">Cycle (ms)</label>
          <input 
            id="cycleDuration"
            type="number" 
            bind:value={cycleDuration} 
            min="500" 
            step="100"
            on:blur={syncToStore}
          >
        </div>
      </div>
    </div>

    {#if mode === 'browser'}
      <!-- Style Settings -->
      <div class="card">
        <h3>Style</h3>
        
        <label for="fontFamily">Font Family</label>
        <select id="fontFamily" bind:value={fontFamily} on:change={syncToStore}>
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
        <input 
          type="text" 
          bind:value={fontFamilyCustom} 
          placeholder="Or enter custom font: 'Font Name', fallback"
          on:blur={syncToStore}
        >
        
        <div class="row">
          <div>
            <label for="fontSize">Font Size</label>
            <input id="fontSize" type="text" bind:value={fontSize} placeholder="48px" on:blur={syncToStore}>
          </div>
          <div>
            <label for="fontWeight">Font Weight</label>
            <select id="fontWeight" bind:value={fontWeight} on:change={syncToStore}>
              <option value="100">Thin</option>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi-Bold</option>
              <option value="700">Bold</option>
              <option value="800">Extra Bold</option>
              <option value="900">Black</option>
            </select>
          </div>
        </div>
        
        <div class="row">
          <div>
            <label for="color">Text Color</label>
            <div class="color-input">
              <input 
                type="color" 
                value={color}
                on:input={(e) => syncColorPicker(e, 'color')}
              >
              <input type="text" bind:value={color} placeholder="#ffffff" on:blur={syncToStore}>
            </div>
          </div>
          <div>
            <label for="textAlign">Text Align</label>
            <select id="textAlign" bind:value={textAlign} on:change={syncToStore}>
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
        
        <div class="row">
          <div>
            <label for="letterSpacing">Letter Spacing</label>
            <input id="letterSpacing" type="text" bind:value={letterSpacing} placeholder="normal" on:blur={syncToStore}>
          </div>
          <div>
            <label for="lineHeight">Line Height</label>
            <input id="lineHeight" type="text" bind:value={lineHeight} placeholder="1.2" on:blur={syncToStore}>
          </div>
        </div>
        
        <div class="row">
          <div>
            <label for="textTransform">Text Transform</label>
            <select id="textTransform" bind:value={textTransform} on:change={syncToStore}>
              <option value="none">None</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
          <div>
            <label for="fontStyle">Font Style</label>
            <select id="fontStyle" bind:value={fontStyle} on:change={syncToStore}>
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </div>
        </div>
        
        <label for="shadow">Text Shadow</label>
        <input id="shadow" type="text" bind:value={shadow} placeholder="2px 2px 4px rgba(0,0,0,0.5)" on:blur={syncToStore}>
        
        <label>Text Stroke (Outline)</label>
        <div class="row">
          <div>
            <input type="text" bind:value={strokeWidth} placeholder="Width: 0, 1px, 2px" on:blur={syncToStore}>
          </div>
          <div>
            <div class="color-input">
              <input 
                type="color" 
                value={strokeColor}
                on:input={(e) => syncColorPicker(e, 'strokeColor')}
              >
              <input type="text" bind:value={strokeColor} placeholder="#000000" on:blur={syncToStore}>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Preview -->
    <div class="card">
      <h3>Preview</h3>
      <div class="preview-container">
        <TextCyclerDisplay propConfigId={configId || 'default'} previewMode={true} />
      </div>
    </div>
    
    <!-- Controls -->
    <div class="controls">
      <div class="row">
        <Tooltip 
          text={$connected ? 'Start cycling through text items' : 'Connect to OBS first'} 
          position="bottom"
          level={$connected ? 'log' : 'warning'}
        >
          <button 
            class="btn-success btn-lg" 
            on:click={handleStartCycler} 
            disabled={!$connected || isRunning}
          >
            ▶ Start
          </button>
        </Tooltip>
        <Tooltip 
          text={$connected ? 'Stop text cycling' : 'Connect to OBS first'} 
          position="bottom"
          level={$connected ? 'log' : 'warning'}
        >
          <button 
            class="btn-danger btn-lg" 
            on:click={handleStopCycler} 
            disabled={!$connected || !isRunning}
          >
            ■ Stop
          </button>
        </Tooltip>
      </div>
      <div class="row" style="margin-top:8px">
        <Tooltip text="Save current configuration" position="bottom">
          <button on:click={handleSaveConfig} disabled={!$connected}>Save Config</button>
        </Tooltip>
        <Tooltip text="Delete current configuration" position="bottom">
          <button class="btn-danger" on:click={handleDeleteConfig} disabled={!$connected}>
            Delete
          </button>
        </Tooltip>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .text-cycler-page {
    max-width: 1200px;
    margin: 0 auto;
    
    .card {
      margin-bottom: 16px;
      padding: 16px;
      background: var(--bg-card);
      border-radius: 8px;
      
      h3 {
        margin: 0 0 12px;
        font-size: 1.1em;
      }
      
      label {
        display: block;
        margin: 8px 0 4px;
        font-size: 0.9em;
        color: var(--text-muted);
      }
      
      input, select, textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg-input);
        color: var(--text);
        font-size: 0.95em;
        
        &:focus {
          outline: none;
          border-color: var(--primary);
        }
      }
      
      textarea {
        resize: vertical;
        font-family: monospace;
      }
    }
    
    .config-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
      max-height: 200px;
      overflow-y: auto;
      
      .config-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--bg-dark);
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        
        &:hover {
          background: var(--bg-hover);
        }
        
        &.selected {
          border-color: var(--primary);
          background: var(--bg-selected);
        }
        
        &.running .name {
          color: var(--success);
        }
        
        .name {
          flex: 1;
          font-weight: 500;
        }
        
        .meta {
          font-size: 0.8em;
          color: var(--text-muted);
        }
        
        .status {
          color: var(--success);
        }
        
        .quick-toggle {
          padding: 4px 8px;
          font-size: 0.8em;
          background: var(--bg-button);
          border: 1px solid var(--border);
          border-radius: 3px;
          cursor: pointer;
          
          &:hover {
            background: var(--bg-hover);
          }
        }
      }
      
      .empty {
        color: var(--text-muted);
        font-size: 0.9em;
        padding: 16px;
        text-align: center;
      }
    }
    
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
        white-space: nowrap;
      }
    }
    
    .hint {
      font-size: 0.75em;
      color: var(--text-muted);
      margin: 4px 0;
      
      &.url-preview code {
        word-break: break-all;
      }
    }
    
    .color-input {
      display: flex;
      gap: 4px;
      
      input[type="color"] {
        width: 40px;
        height: 32px;
        padding: 0;
        border: none;
        cursor: pointer;
      }
      
      input[type="text"] {
        flex: 1;
      }
    }
    
    .preview-container {
      min-height: 200px;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .controls {
      margin-top: 8px;
      
      button {
        width: 100%;
      }
      
      .btn-lg {
        padding: 12px;
        font-size: 1.1em;
      }
      
      .btn-success {
        background: var(--success);
        border-color: var(--success);
        color: white;
        
        &:disabled {
          opacity: 0.5;
        }
      }
      
      .btn-danger {
        background: var(--danger);
        border-color: var(--danger);
        color: white;
        
        &:disabled {
          opacity: 0.5;
        }
      }
    }
  }
</style>
