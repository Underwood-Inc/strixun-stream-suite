<script lang="ts">
  /**
   * Advanced Search Input Component
   * 
   * Human-friendly search input with support for:
   * - Quoted exact phrases: "exact phrase"
   * - Space-separated AND terms: term1 term2
   * - Pipe-separated OR groups: term1 | term2
   * - Wildcard prefix matching: term*
   * 
   * @example
   * <AdvancedSearchInput
   *   value={searchQuery}
   *   onInput={(value) => setSearchQuery(value)}
   *   placeholder="Search..."
   * />
   */
  
  import Tooltip from '../tooltip/Tooltip.svelte';
  
  export let value: string = '';
  export let placeholder: string = 'Search... (use "quotes" for exact, space for AND, | for OR)';
  export let inputId: string = `advanced-search-${Math.random().toString(36).substr(2, 9)}`;
  export let showHint: boolean = true;
  export let onInput: ((value: string) => void) | null = null;
  export let onClear: (() => void) | null = null;
  
  let inputElement: HTMLInputElement;
  
  function handleInput(): void {
    const newValue = inputElement.value;
    value = newValue;
    if (onInput) {
      onInput(newValue);
    }
  }
  
  function handleClear(): void {
    inputElement.value = '';
    value = '';
    if (onInput) {
      onInput('');
    }
    if (onClear) {
      onClear();
    }
    inputElement.focus();
  }
</script>

<div class="advanced-search-input">
  <div class="advanced-search-input__wrapper">
    <span class="advanced-search-input__icon">🔍</span>
      <input
        type="text"
        class="advanced-search-input__field"
        id={inputId}
        bind:this={inputElement}
        {placeholder}
        {value}
        on:input={handleInput}
      />
    {#if value.trim()}
      <button
        class="advanced-search-input__clear"
        on:click={handleClear}
        type="button"
        aria-label="Clear search"
        title="Clear search"
      >
        ✕
      </button>
    {/if}
  </div>
  {#if showHint}
    <div class="advanced-search-input__hint">
      <small>Use quotes for exact phrases, space for AND, | for OR</small>
    </div>
  {/if}
</div>

<style lang="scss">
  .advanced-search-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .advanced-search-input__wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .advanced-search-input__icon {
    position: absolute;
    left: 12px;
    font-size: 1em;
    pointer-events: none;
    z-index: 1;
  }
  
  .advanced-search-input__field {
    width: 100%;
    padding: 10px 32px 10px 36px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.9em;
    transition: all 0.2s ease;
  }
  
  .advanced-search-input__field:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.1);
  }
  
  .advanced-search-input__field::placeholder {
    color: var(--muted);
    font-size: 0.85em;
  }
  
  .advanced-search-input__clear {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85em;
    border-radius: 4px;
    transition: all 0.2s ease;
    z-index: 1;
  }
  
  .advanced-search-input__clear:hover {
    color: var(--text);
    background: var(--border);
  }
  
  .advanced-search-input__hint {
    margin-top: 0;
    color: var(--muted);
  }
  
  .advanced-search-input__hint small {
    font-size: 0.75em;
    line-height: 1.4;
  }
</style>

