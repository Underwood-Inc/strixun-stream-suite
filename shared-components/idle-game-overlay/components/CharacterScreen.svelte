<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameApi } from '../services/game-api.js';
  import { currentCharacterId, currentCharacter, loadCharacter } from '../stores/game-state.js';
  import PixelEditor from './PixelEditor.svelte';
  import type { CharacterAppearance } from '../types/index.js';

  let characterId = '';
  let loading = true;
  let error: string | null = null;
  let editingAppearance = false;
  let currentLayer: 'head' | 'torso' | 'arms' | 'legs' = 'head';
  let appearanceData: CharacterAppearance | null = null;

  const unsubscribeCharacterId = currentCharacterId.subscribe(value => {
    characterId = value || '';
    if (characterId) {
      loadCharacter(characterId);
    }
  });

  const unsubscribeCharacter = currentCharacter.subscribe(character => {
    if (character) {
      appearanceData = character.appearance;
      loading = false;
    }
  });

  onDestroy(() => {
    unsubscribeCharacterId();
    unsubscribeCharacter();
  });


  function handleStartEdit() {
    editingAppearance = true;
  }

  function handleCancelEdit() {
    editingAppearance = false;
  }

  async function handleSaveAppearance(customTextures: Record<string, string>) {
    if (!characterId || !appearanceData) return;

    try {
      error = null;
      await gameApi.updateAppearance(characterId, appearanceData, customTextures);
      editingAppearance = false;
      await loadCharacter(); // Refresh character data
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save appearance';
      console.error('Failed to save appearance:', err);
    }
  }

  function handlePixelEditorSave(data: string) {
    if (!appearanceData) return;
    
    // Store pixel editor data for the current layer
    const customTextures: Record<string, string> = {
      [currentLayer]: data
    };
    
    handleSaveAppearance(customTextures);
  }
</script>

<div class="character-screen">
  {#if loading}
    <div class="character-screen__loading">Loading character...</div>
  {:else if error}
    <div class="character-screen__error">
      <p class="character-screen__error-message">{error}</p>
      <button class="character-screen__retry" on:click={loadCharacter}>Retry</button>
    </div>
  {:else if $currentCharacter}
    <div class="character-screen__layout">
      <div class="character-screen__info">
        <h3 class="character-screen__name">{$currentCharacter.name}</h3>
        <div class="character-screen__stats">
          <div class="character-screen__stat">
            <span class="character-screen__stat-label">Level:</span>
            <span class="character-screen__stat-value">{$currentCharacter.level}</span>
          </div>
          <div class="character-screen__stat">
            <span class="character-screen__stat-label">Experience:</span>
            <span class="character-screen__stat-value">{$currentCharacter.experience}</span>
          </div>
        </div>

        {#if !editingAppearance}
          <button class="character-screen__edit-button" on:click={handleStartEdit}>
            Edit Appearance
          </button>
        {/if}
      </div>

      {#if editingAppearance}
        <div class="character-screen__editor">
          <div class="character-screen__editor-header">
            <h4 class="character-screen__editor-title">Pixel Editor</h4>
            <div class="character-screen__layer-selector">
              <button 
                class="character-screen__layer-button"
                class:character-screen__layer-button--active={currentLayer === 'head'}
                on:click={() => currentLayer = 'head'}
              >
                Head
              </button>
              <button 
                class="character-screen__layer-button"
                class:character-screen__layer-button--active={currentLayer === 'torso'}
                on:click={() => currentLayer = 'torso'}
              >
                Torso
              </button>
              <button 
                class="character-screen__layer-button"
                class:character-screen__layer-button--active={currentLayer === 'arms'}
                on:click={() => currentLayer = 'arms'}
              >
                Arms
              </button>
              <button 
                class="character-screen__layer-button"
                class:character-screen__layer-button--active={currentLayer === 'legs'}
                on:click={() => currentLayer = 'legs'}
              >
                Legs
              </button>
            </div>
          </div>
          
          <PixelEditor 
            access="basic"
            layerType={currentLayer}
            onSave={handlePixelEditorSave}
          />

          <div class="character-screen__editor-actions">
            <button class="character-screen__cancel-button" on:click={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="character-screen__preview">
          <div class="character-screen__preview-placeholder">
            Character Preview
          </div>
          {#if appearanceData}
            <p class="character-screen__preview-note">
              Customize your character's appearance using the pixel editor.
            </p>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="character-screen__no-character">
      <p class="character-screen__no-character-message">No character found. Create one to get started!</p>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .character-screen {
    max-width: 1000px;
    margin: 0 auto;
  }

  .character-screen .character-screen__loading,
  .character-screen .character-screen__error {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .character-screen .character-screen__error-message {
    color: var(--danger);
    margin-bottom: var(--spacing-md);
  }

  .character-screen .character-screen__retry {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
  }

  .character-screen .character-screen__layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--spacing-lg);
  }

  .character-screen .character-screen__name {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .character-screen .character-screen__stats {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .character-screen .character-screen__stat {
    display: flex;
    justify-content: space-between;
    padding: var(--spacing-sm);
    background: var(--bg-dark);
    border-radius: var(--border-radius-sm);
  }

  .character-screen .character-screen__stat-label {
    color: var(--muted);
  }

  .character-screen .character-screen__stat-value {
    font-weight: 600;
    color: var(--accent);
  }

  .character-screen .character-screen__edit-button {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-md);
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .character-screen .character-screen__edit-button:hover {
    transform: translateY(-2px);
  }

  .character-screen .character-screen__editor {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border-radius: var(--border-radius-md);
  }

  .character-screen .character-screen__editor-header {
    margin-bottom: var(--spacing-lg);
  }

  .character-screen .character-screen__editor-title {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.2rem;
    color: var(--text);
  }

  .character-screen .character-screen__layer-selector {
    display: flex;
    gap: var(--spacing-xs);
  }

  .character-screen .character-screen__layer-button {
    flex: 1;
    padding: var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .character-screen .character-screen__layer-button:hover {
    background: var(--bg-dark);
  }

  .character-screen .character-screen__layer-button--active {
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border-color: var(--accent);
  }

  .character-screen .character-screen__editor-actions {
    margin-top: var(--spacing-lg);
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }

  .character-screen .character-screen__cancel-button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--border-radius-sm);
    color: var(--text);
    cursor: pointer;
  }

  .character-screen .character-screen__preview {
    padding: var(--spacing-lg);
    background: var(--bg-dark);
    border-radius: var(--border-radius-md);
    min-height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .character-screen .character-screen__preview-placeholder {
    font-size: 1.5rem;
    color: var(--muted);
    margin-bottom: var(--spacing-md);
  }

  .character-screen .character-screen__preview-note {
    color: var(--muted);
    font-size: 0.9rem;
    text-align: center;
  }

  .character-screen .character-screen__no-character {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--muted);
  }
</style>

