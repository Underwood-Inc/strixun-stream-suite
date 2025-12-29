<script lang="ts">
  /**
   * ThemeSettings Component
   * 
   * Overlay widget for customizing UI theme settings including fonts.
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { theme, setFontFamily, resetTheme, AVAILABLE_FONTS } from '../../stores/theme';

  export let visible = false;
  export let onClose: (() => void) | null = null;

  let selectedFont = '';

  // Sync selected font with theme store
  $: {
    if ($theme) {
      selectedFont = $theme.fontFamily;
    }
  }

  function handleFontChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target) {
      setFontFamily(target.value);
    }
  }

  function handleReset(): void {
    resetTheme();
  }

  function handleClose(): void {
    if (onClose) {
      onClose();
    } else {
      visible = false;
    }
  }

  // Close on Escape key
  function handleKeydown(event: KeyboardEvent): void {
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
  <div class="theme-settings" role="dialog" aria-modal="true" aria-label="Theme Settings">
    <div class="theme-settings__backdrop" on:click={handleClose}></div>
    
    <div class="theme-settings__container">
      <header class="theme-settings__header">
        <h2 class="theme-settings__title">Theme Settings</h2>
        <button class="theme-settings__close" on:click={handleClose} aria-label="Close theme settings">
          <span class="theme-settings__close-icon">×</span>
        </button>
      </header>

      <main class="theme-settings__content">
        <section class="theme-settings__section">
          <h3 class="theme-settings__section-title">Typography</h3>
          
          <div class="theme-settings__field">
            <label class="theme-settings__label" for="font-family-select">
              Font Family
            </label>
            <select
              id="font-family-select"
              class="theme-settings__select"
              value={selectedFont}
              on:change={handleFontChange}
            >
              {#each AVAILABLE_FONTS as font}
                <option value={font.value}>{font.name}</option>
              {/each}
            </select>
            <p class="theme-settings__help">
              Choose a font family for the entire application interface.
            </p>
          </div>
        </section>

        <section class="theme-settings__section">
          <div class="theme-settings__actions">
            <button class="theme-settings__reset" on:click={handleReset}>
              Reset to Default
            </button>
          </div>
        </section>
      </main>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../styles/variables' as *;

  .theme-settings {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .theme-settings .theme-settings__backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    pointer-events: all;
  }

  .theme-settings .theme-settings__container {
    position: relative;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: all;
  }

  .theme-settings .theme-settings__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
  }

  .theme-settings .theme-settings__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
  }

  .theme-settings .theme-settings__close {
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    padding: var(--spacing-xs);
    border-radius: var(--radius-sm);
    transition: background-color 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .theme-settings .theme-settings__close:hover {
    background: var(--border);
  }

  .theme-settings .theme-settings__close-icon {
    display: block;
  }

  .theme-settings .theme-settings__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
  }

  .theme-settings .theme-settings__section {
    margin-bottom: var(--spacing-xl);
  }

  .theme-settings .theme-settings__section:last-child {
    margin-bottom: 0;
  }

  .theme-settings .theme-settings__section-title {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }

  .theme-settings .theme-settings__field {
    margin-bottom: var(--spacing-md);
  }

  .theme-settings .theme-settings__label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .theme-settings .theme-settings__select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 1rem;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }

  .theme-settings .theme-settings__select:hover {
    border-color: var(--border-light);
  }

  .theme-settings .theme-settings__select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
  }

  .theme-settings .theme-settings__help {
    margin: var(--spacing-xs) 0 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .theme-settings .theme-settings__actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: flex-end;
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }

  .theme-settings .theme-settings__reset {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .theme-settings .theme-settings__reset:hover {
    background: var(--border);
    border-color: var(--border-light);
  }

  .theme-settings .theme-settings__reset:active {
    transform: translateY(1px);
  }
</style>

