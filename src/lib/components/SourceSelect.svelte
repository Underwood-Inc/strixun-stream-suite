<script lang="ts">
  /**
   * SourceSelect Component
   * 
   * Reusable, composable source selection dropdown with search functionality.
   * Reactively updates from the sources store.
   * 
   * @example
   * <SourceSelect
   *   bind:value={selectedSource}
   *   placeholder="-- Select Source --"
   *   filter={(source) => true}
   *   on:change={handleChange}
   * />
   */
  
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { sources } from '../../stores/connection';
  import type { Source } from '../../types';
  // import ComponentDocsButton from './ComponentDocsButton.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Props
  export let value: string = '';
  export let placeholder: string = '-- Select Source --';
  export let filter: ((source: Source) => boolean) | null = null;
  export let disabled: boolean = false;
  export let id: string | null = null;
  export let searchable: boolean = false;
  export let minSearchChars: number = 1;
  
  // Internal state
  let searchQuery = '';
  let isOpen = false;
  let selectElement: HTMLSelectElement;
  let searchInput: HTMLInputElement;
  let dropdownContainer: HTMLDivElement;
  
  // Filtered sources based on filter prop and search query
  $: filteredSources = (() => {
    let srcs = $sources;
    
    // Apply filter function if provided
    if (filter) {
      srcs = srcs.filter(filter);
    }
    
    // Apply search filter if searchable and query exists
    if (searchable && searchQuery.trim().length >= minSearchChars) {
      const query = searchQuery.toLowerCase().trim();
      srcs = srcs.filter(s => 
        s.sourceName.toLowerCase().includes(query)
      );
    }
    
    return srcs;
  })();
  
  // Handle value change
  function handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    value = target.value;
    dispatch('change', { value });
  }
  
  // Handle search input (for searchable mode)
  function handleSearchInput(): void {
    searchQuery = searchInput.value;
  }
  
  // Clear search
  function clearSearch(): void {
    searchQuery = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }
  
  // Select source from searchable dropdown
  function selectSource(sourceName: string): void {
    value = sourceName;
    searchQuery = '';
    isOpen = false;
    dispatch('change', { value });
  }
  
  // Toggle dropdown
  function toggleDropdown(): void {
    if (!searchable) return;
    isOpen = !isOpen;
    if (isOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 0);
    }
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent): void {
    if (searchable && dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
      isOpen = false;
      searchQuery = '';
    }
  }
  
  // Get display value
  $: displayValue = value 
    ? filteredSources.find(s => s.sourceName === value)?.sourceName || value
    : placeholder;
  
  onMount(() => {
    if (searchable) {
      document.addEventListener('click', handleClickOutside);
    }
  });
  
  onDestroy(() => {
    if (searchable) {
      document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

{#if searchable}
  <!-- Searchable Dropdown -->
  <div class="source-select-wrapper" style="position: relative;">
    <!-- <ComponentDocsButton componentName="SourceSelect" position="top-right" size="small" /> -->
    <div class="source-select source-select--searchable" bind:this={dropdownContainer}>
    <button
      type="button"
      class="source-select__trigger"
      class:source-select__trigger--open={isOpen}
      class:source-select__trigger--disabled={disabled}
      disabled={disabled}
      on:click={toggleDropdown}
    >
      <span class="source-select__value" class:source-select__value--placeholder={!value}>
        {displayValue}
      </span>
      <span class="source-select__arrow">▼</span>
    </button>
    
    {#if isOpen}
      <div class="source-select__dropdown">
        <div class="source-select__search">
          <span class="source-select__search-icon">[SEARCH]</span>
          <input
            type="text"
            class="source-select__search-input"
            placeholder="Search sources..."
            bind:this={searchInput}
            bind:value={searchQuery}
            on:input={handleSearchInput}
          />
          {#if searchQuery}
            <button
              type="button"
              class="source-select__search-clear"
              on:click={clearSearch}
            >
              [EMOJI]
            </button>
          {/if}
        </div>
        
        <div class="source-select__options">
          {#if filteredSources.length === 0}
            <div class="source-select__no-results">
              {searchQuery.trim().length >= minSearchChars 
                ? 'No sources found' 
                : 'No sources available'}
            </div>
          {:else}
            {#each filteredSources as source (source.sourceName)}
              <button
                type="button"
                class="source-select__option"
                class:source-select__option--selected={value === source.sourceName}
                on:click={() => selectSource(source.sourceName)}
              >
                {source.sourceName}
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
    </div>
  </div>
{:else}
  <!-- Native Select -->
  <select
    bind:this={selectElement}
    bind:value
    {id}
    {disabled}
    class="source-select source-select--native"
    on:change={handleChange}
  >
    <option value="">{placeholder}</option>
    {#each filteredSources as source (source.sourceName)}
      <option value={source.sourceName}>{source.sourceName}</option>
    {/each}
  </select>
{/if}

<style lang="scss">
  @use '@styles/components/forms';
  
  .source-select {
    position: relative;
    width: 100%;
  }
  
  .source-select--native {
    // Native select styling is handled by forms.scss
  }
  
  .source-select--searchable {
    // Searchable dropdown container
  }
  
  .source-select__trigger {
    width: 100%;
    padding: 8px 32px 8px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s ease;
    text-align: left;
    
    &:hover:not(.source-select__trigger--disabled) {
      border-color: var(--accent);
      background: var(--border);
    }
    
    &:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
    }
    
    &.source-select__trigger--open {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
    }
    
    &.source-select__trigger--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .source-select__value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    
    &.source-select__value--placeholder {
      color: var(--muted);
    }
  }
  
  .source-select__arrow {
    flex-shrink: 0;
    margin-left: 8px;
    font-size: 10px;
    color: var(--muted);
    transition: transform 0.2s ease;
    
    .source-select__trigger--open & {
      transform: rotate(180deg);
    }
  }
  
  .source-select__dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .source-select__search {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--card);
  }
  
  .source-select__search-icon {
    flex-shrink: 0;
    color: var(--muted);
  }
  
  .source-select__search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    outline: none;
    
    &::placeholder {
      color: var(--muted);
    }
  }
  
  .source-select__search-clear {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    font-size: 12px;
    
    &:hover {
      background: var(--border);
      color: var(--text);
    }
  }
  
  .source-select__options {
    flex: 1;
    overflow-y: auto;
    max-height: 250px;
  }
  
  .source-select__option {
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    
    &:hover {
      background: var(--border);
    }
    
    &.source-select__option--selected {
      background: var(--accent);
      color: var(--accent-text, #fff);
    }
  }
  
  .source-select__no-results {
    padding: 16px 12px;
    text-align: center;
    color: var(--muted);
    font-size: 14px;
  }
</style>

