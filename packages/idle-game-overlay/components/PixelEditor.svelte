<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { PixelEditor as PixelEditorCore, type PixelEditorTool } from '../core/pixel-editor';
  import type { PixelEditorAccess } from '../types/character-customization';
  import { PIXEL_EDITOR_FEATURES } from '../types/character-customization';

  export let access: PixelEditorAccess = 'basic';
  export let layerType: 'head' | 'torso' | 'arms' | 'legs' = 'head';
  export let onSave: ((data: string) => void) | null = null;

  let canvas: HTMLCanvasElement;
  let editor: PixelEditorCore | null = null;
  let currentTool: PixelEditorTool = 'pencil';
  let currentColor = '#000000';
  let pixelSize = 8;
  let gridEnabled = true;
  let canUndo = false;
  let canRedo = false;

  const features = PIXEL_EDITOR_FEATURES[access];
  const maxSize = features.maxCanvasSize;

  onMount(() => {
    if (canvas) {
      editor = new PixelEditorCore(
        canvas,
        Math.min(64, maxSize.width),
        Math.min(64, maxSize.height),
        pixelSize
      );
      
      editor.setTool(currentTool);
      editor.setColor(currentColor);
      updateHistoryState();
    }
  });

  onDestroy(() => {
    // Cleanup if needed
  });

  function handleToolSelect(tool: PixelEditorTool) {
    currentTool = tool;
    editor?.setTool(tool);
  }

  function handleColorSelect(color: string) {
    currentColor = color;
    editor?.setColor(color);
  }

  function handlePixelSizeChange(size: number) {
    pixelSize = size;
    editor?.setPixelSize(size);
  }

  function handleGridToggle() {
    gridEnabled = !gridEnabled;
    editor?.toggleGrid();
  }

  function handleUndo() {
    if (editor?.undo()) {
      updateHistoryState();
    }
  }

  function handleRedo() {
    if (editor?.redo()) {
      updateHistoryState();
    }
  }

  function updateHistoryState() {
    // This would be updated by the editor
    // For now, just placeholder
    canUndo = true;
    canRedo = false;
  }

  function handleSave() {
    if (!editor || !onSave) return;
    const data = editor.exportAsBase64('png');
    onSave(data);
  }

  function handleClear() {
    if (!editor) return;
    // Clear canvas logic
  }

  const defaultPalette = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#808080', '#800000',
    '#008000', '#000080', '#808000', '#800080', '#008080',
    '#c0c0c0'
  ];
</script>

<div class="pixel-editor">
  <div class="pixel-editor__toolbar">
    <div class="pixel-editor__tool-group">
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'pencil'}
        on:click={() => handleToolSelect('pencil')}
        title="Pencil"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'eraser'}
        on:click={() => handleToolSelect('eraser')}
        title="Eraser"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'bucket'}
        on:click={() => handleToolSelect('bucket')}
        title="Bucket Fill"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'eyedropper'}
        on:click={() => handleToolSelect('eyedropper')}
        title="Eyedropper"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'line'}
        on:click={() => handleToolSelect('line')}
        title="Line"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'rectangle'}
        on:click={() => handleToolSelect('rectangle')}
        title="Rectangle"
      >
        ▭
      </button>
      <button
        class="pixel-editor__tool"
        class:active={currentTool === 'circle'}
        on:click={() => handleToolSelect('circle')}
        title="Circle"
      >
        
      </button>
    </div>

    <div class="pixel-editor__tool-group">
      <button
        class="pixel-editor__tool"
        disabled={!canUndo}
        on:click={handleUndo}
        title="Undo (Ctrl+Z)"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        disabled={!canRedo}
        on:click={handleRedo}
        title="Redo (Ctrl+Y)"
      >
        
      </button>
      <button
        class="pixel-editor__tool"
        class:active={gridEnabled}
        on:click={handleGridToggle}
        title="Toggle Grid"
      >
        ⊞
      </button>
    </div>

    <div class="pixel-editor__tool-group">
      <button
        class="pixel-editor__tool pixel-editor__tool--danger"
        on:click={handleClear}
        title="Clear Canvas"
      > ★ ️
      </button>
      <button
        class="pixel-editor__tool pixel-editor__tool--primary"
        on:click={handleSave}
        title="Save"
      >
         Save
      </button>
    </div>
  </div>

  <div class="pixel-editor__main">
    <div class="pixel-editor__canvas-container">
      <canvas
        bind:this={canvas}
        class="pixel-editor__canvas"
      ></canvas>
    </div>

    <div class="pixel-editor__sidebar">
      <div class="pixel-editor__section">
        <h3>Color Palette</h3>
        <div class="pixel-editor__palette">
          {#each defaultPalette as color}
            <button
              class="pixel-editor__color"
              class:active={currentColor === color}
              style="background-color: {color};"
              on:click={() => handleColorSelect(color)}
              title={color}
            ></button>
          {/each}
        </div>
        <input
          type="color"
          bind:value={currentColor}
          on:input={(e) => handleColorSelect(e.target.value)}
          class="pixel-editor__color-picker"
        />
      </div>

      <div class="pixel-editor__section">
        <h3>Zoom</h3>
        <input
          type="range"
          min="4"
          max="32"
          bind:value={pixelSize}
          on:input={(e) => handlePixelSizeChange(Number(e.target.value))}
          class="pixel-editor__slider"
        />
        <span class="pixel-editor__value">{pixelSize}x</span>
      </div>

      {#if features.advancedTools}
        <div class="pixel-editor__section">
          <h3>Layers ({editor?.state.layers.length || 0}/{features.maxLayers})</h3>
          <!-- Layer management UI would go here -->
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  @use '../shared-styles/_variables.scss' as *;
  @use '../shared-styles/_animations.scss' as *;

  .pixel-editor {
    display: flex;
    flex-direction: column;
    background: var(--card, #1a1a2e);
    border-radius: 8px;
    padding: 16px;
    gap: 16px;
  }

  .pixel-editor__toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .pixel-editor__tool-group {
    display: flex;
    gap: 4px;
    padding-right: 8px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);

    &:last-child {
      border-right: none;
    }
  }

  .pixel-editor__tool {
    padding: 8px 12px;
    background: var(--button, #2a2a3e);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: var(--text, #f0f0f0);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: var(--button-hover, #3a3a4e);
      border-color: var(--accent, #4a90e2);
    }

    &.active {
      background: var(--accent, #4a90e2);
      border-color: var(--accent, #4a90e2);
      color: white;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--primary {
      background: var(--accent, #4a90e2);
      color: white;
      font-weight: 600;

      &:hover {
        background: var(--accent-hover, #5aa0f2);
      }
    }

    &--danger {
      background: #d32f2f;
      color: white;

      &:hover {
        background: #e53935;
      }
    }
  }

  .pixel-editor__main {
    display: flex;
    gap: 16px;
  }

  .pixel-editor__canvas-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    padding: 16px;
    min-height: 400px;
  }

  .pixel-editor__canvas {
    border: 1px solid rgba(0, 0, 0, 0.2);
    cursor: crosshair;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  .pixel-editor__sidebar {
    width: 250px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .pixel-editor__section {
    h3 {
      margin: 0 0 12px 0;
      font-size: 0.9em;
      color: var(--text-secondary, #b0b0b0);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  .pixel-editor__palette {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 12px;
  }

  .pixel-editor__color {
    aspect-ratio: 1;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.1);
      border-color: var(--accent, #4a90e2);
    }

    &.active {
      border-color: var(--accent, #4a90e2);
      box-shadow: 0 0 8px var(--accent, #4a90e2);
    }
  }

  .pixel-editor__color-picker {
    width: 100%;
    height: 40px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    cursor: pointer;
  }

  .pixel-editor__slider {
    width: 100%;
    margin-bottom: 8px;
  }

  .pixel-editor__value {
    display: block;
    text-align: center;
    color: var(--text-secondary, #b0b0b0);
    font-size: 0.9em;
  }
</style>

