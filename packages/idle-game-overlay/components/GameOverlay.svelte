<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  // Note: isAuthenticated should be provided as a prop or store from the consuming app
  // This component should not depend on app-specific stores
  import DailyLootBox from './DailyLootBox.svelte';
  import InventoryScreen from './InventoryScreen.svelte';
  import CharacterScreen from './CharacterScreen.svelte';
  import IdleProgress from './IdleProgress.svelte';
  import CraftingScreen from './CraftingScreen.svelte';
  import DungeonScreen from './DungeonScreen.svelte';

  export let visible = false;
  export let onClose: (() => void) | null = null;
  export let isAuthenticated: boolean = false; // Provided by consuming app

  type Screen = 'home' | 'loot-box' | 'inventory' | 'character' | 'idle' | 'crafting' | 'dungeons';

  let currentScreen: Screen = 'home';

  function handleScreenChange(screen: Screen) {
    currentScreen = screen;
  }

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      visible = false;
    }
  }

  // Close on Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && visible) {
      handleClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if visible}
  <div class="game-overlay" role="dialog" aria-modal="true" aria-label="Idle Game Overlay">
    <div class="game-overlay__backdrop" on:click={handleClose}></div>
    
    <div class="game-overlay__container">
      <header class="game-overlay__header">
        <h2 class="game-overlay__title">Idle Game</h2>
        <button class="game-overlay__close" on:click={handleClose} aria-label="Close overlay">
          <span class="game-overlay__close-icon">×</span>
        </button>
      </header>

      <nav class="game-overlay__nav">
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'home'}
          on:click={() => handleScreenChange('home')}
        >
          Home
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'loot-box'}
          on:click={() => handleScreenChange('loot-box')}
        >
          Daily Box
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'inventory'}
          on:click={() => handleScreenChange('inventory')}
        >
          Inventory
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'character'}
          on:click={() => handleScreenChange('character')}
        >
          Character
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'idle'}
          on:click={() => handleScreenChange('idle')}
        >
          Idle
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'crafting'}
          on:click={() => handleScreenChange('crafting')}
        >
          Crafting
        </button>
        <button 
          class="game-overlay__nav-item"
          class:game-overlay__nav-item--active={currentScreen === 'dungeons'}
          on:click={() => handleScreenChange('dungeons')}
        >
          Dungeons
        </button>
      </nav>

      <main class="game-overlay__content">
        {#if !isAuthenticated}
          <div class="game-overlay__auth-required">
            <p class="game-overlay__auth-message">Please log in to access the idle game.</p>
          </div>
        {:else if currentScreen === 'home'}
          <div class="game-overlay__home">
            <h3 class="game-overlay__home-title">Welcome to the Idle Game!</h3>
            <p class="game-overlay__home-description">
              Manage your character, claim daily rewards, craft items, and explore dungeons.
            </p>
            <div class="game-overlay__home-quick-actions">
              <button class="game-overlay__quick-action" on:click={() => handleScreenChange('loot-box')}>
                Claim Daily Box
              </button>
              <button class="game-overlay__quick-action" on:click={() => handleScreenChange('idle')}>
                Check Idle Progress
              </button>
            </div>
          </div>
        {:else if currentScreen === 'loot-box'}
          <DailyLootBox />
        {:else if currentScreen === 'inventory'}
          <InventoryScreen />
        {:else if currentScreen === 'character'}
          <CharacterScreen />
        {:else if currentScreen === 'idle'}
          <IdleProgress />
        {:else if currentScreen === 'crafting'}
          <CraftingScreen />
        {:else if currentScreen === 'dungeons'}
          <DungeonScreen />
        {/if}
      </main>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../../src/styles/variables' as *;

  .game-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .game-overlay .game-overlay__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
  }

  .game-overlay .game-overlay__container {
    position: relative;
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--border-radius-lg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .game-overlay .game-overlay__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
  }

  .game-overlay .game-overlay__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
  }

  .game-overlay .game-overlay__close {
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--border-radius-sm);
    transition: background-color 0.2s ease;
  }

  .game-overlay .game-overlay__close:hover {
    background: var(--bg-dark);
  }

  .game-overlay .game-overlay__close-icon {
    display: block;
  }

  .game-overlay .game-overlay__nav {
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    overflow-x: auto;
  }

  .game-overlay .game-overlay__nav-item {
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm);
    color: var(--text);
    cursor: pointer;
    font-size: 0.9rem;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .game-overlay .game-overlay__nav-item:hover {
    background: var(--bg-dark);
    border-color: var(--border);
  }

  .game-overlay .game-overlay__nav-item--active {
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border-color: var(--accent);
  }

  .game-overlay .game-overlay__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .game-overlay .game-overlay__auth-required {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
  }

  .game-overlay .game-overlay__auth-message {
    color: var(--muted);
    font-size: 1.1rem;
  }

  .game-overlay .game-overlay__home {
    text-align: center;
  }

  .game-overlay .game-overlay__home-title {
    font-size: 2rem;
    margin-bottom: var(--spacing-md);
    color: var(--text);
  }

  .game-overlay .game-overlay__home-description {
    color: var(--muted);
    margin-bottom: var(--spacing-xl);
    font-size: 1.1rem;
  }

  .game-overlay .game-overlay__home-quick-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
  }

  .game-overlay .game-overlay__quick-action {
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--accent);
    color: var(--text-on-accent, #000);
    border: none;
    border-radius: var(--border-radius-md);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s ease, box-shadow 0.2s ease;
  }

  .game-overlay .game-overlay__quick-action:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .game-overlay .game-overlay__quick-action:active {
    transform: translateY(0);
  }
</style>

