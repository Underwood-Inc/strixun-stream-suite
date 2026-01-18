<script lang="ts">
  /**
   * Generic Select Component - Atomic Design
   * 
   * Reusable searchable dropdown for any data type
   */
  
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  
  type Item = {
    value: string;
    label: string;
    badge?: string | number;
  };
  
  const dispatch = createEventDispatcher();
  
  // Portal action to render dropdown at body level
  function portal(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
    return {
      update(newTarget: HTMLElement) {
        if (newTarget !== target) {
          newTarget.appendChild(node);
          target = newTarget;
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
  
  // Props
  export let value: string = '';
  export let items: Item[] = [];
  export let placeholder: string = '-- Select --';
  export let disabled: boolean = false;
  export let searchable: boolean = true;
  
  // Internal state
  let searchQuery = '';
  let isOpen = false;
  let searchInput: HTMLInputElement;
  let dropdownContainer: HTMLDivElement;
  let triggerButton: HTMLButtonElement;
  let portalContainer: HTMLDivElement | null = null;
  let dropdownPosition = { top: 0, left: 0, width: 0 };
  
  // Filtered items
  $: filteredItems = searchQuery.trim().length === 0
    ? items
    : items.filter(item => 
        item.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
  
  // Display value
  $: displayValue = value 
    ? items.find(i => i.value === value)?.label || value
    : placeholder;
  
  // Reactive: Update position when dropdown opens or trigger button changes
  $: if (isOpen && triggerButton) {
    updateDropdownPosition();
  }
  
  // Select item
  function selectItem(itemValue: string): void {
    value = itemValue;
    searchQuery = '';
    isOpen = false;
    dispatch('change', { value });
  }
  
  // Update dropdown position
  function updateDropdownPosition(): void {
    if (!isOpen || !triggerButton) return;
    
    const rect = triggerButton.getBoundingClientRect();
    dropdownPosition = {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    };
  }
  
  // Toggle dropdown
  function toggleDropdown(): void {
    isOpen = !isOpen;
    if (isOpen && triggerButton) {
      updateDropdownPosition();
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 0);
      }
    }
  }
  
  // Reposition dropdown on scroll (but not if scrolling inside dropdown)
  function handleScroll(event: Event): void {
    if (!isOpen) return;
    
    // Don't reposition if scrolling inside the dropdown itself
    const target = event.target as HTMLElement;
    if (dropdownContainer?.contains(target) || portalContainer?.contains(target)) {
      return;
    }
    
    // Reposition using requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      updateDropdownPosition();
    });
  }
  
  // Clear search
  function clearSearch(): void {
    searchQuery = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }
  
  // Close on click outside
  function handleClickOutside(event: MouseEvent): void {
    const target = event.target as Node;
    // Check if click is inside trigger OR dropdown (including portal)
    const clickedInside = dropdownContainer?.contains(target) || 
                          (portalContainer && portalContainer.contains(target));
    
    if (!clickedInside) {
      isOpen = false;
      searchQuery = '';
    }
  }
  
  onMount(() => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.style.position = 'fixed';
    portalContainer.style.zIndex = '99999';
    portalContainer.style.pointerEvents = 'none';
    document.body.appendChild(portalContainer);
    
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scrolls
    window.addEventListener('resize', updateDropdownPosition); // Reposition on resize too
  });
  
  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', handleScroll, true);
    window.removeEventListener('resize', updateDropdownPosition);
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
</script>

<div class="select" bind:this={dropdownContainer}>
  <button
    type="button"
    class="select__trigger"
    class:select__trigger--open={isOpen}
    class:select__trigger--disabled={disabled}
    disabled={disabled}
    on:click={toggleDropdown}
    bind:this={triggerButton}
  >
    <span class="select__value" class:select__value--placeholder={!value}>
      {displayValue}
    </span>
    <span class="select__arrow">▼</span>
  </button>
  
  {#if isOpen && portalContainer}
    <div 
      class="select__dropdown"
      use:portal={portalContainer}
      style:top="{dropdownPosition.top}px"
      style:left="{dropdownPosition.left}px"
      style:min-width="{dropdownPosition.width}px"
      style:pointer-events="auto"
    >
      {#if searchable}
        <div class="select__search">
          <span class="select__search-icon">🔍</span>
          <input
            type="text"
            class="select__search-input"
            placeholder="Search..."
            bind:this={searchInput}
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button
              type="button"
              class="select__search-clear"
              on:click={clearSearch}
            >
              ✕
            </button>
          {/if}
        </div>
      {/if}
      
      <div class="select__options">
        {#if filteredItems.length === 0}
          <div class="select__no-results">
            {searchQuery.trim().length > 0 ? 'No results found' : 'No items available'}
          </div>
        {:else}
          {#each filteredItems as item (item.value)}
            <button
              type="button"
              class="select__option"
              class:select__option--selected={value === item.value}
              on:click={() => selectItem(item.value)}
            >
              <span class="select__option-label">{item.label}</span>
              {#if item.badge}
                <span class="select__option-badge">{item.badge}</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .select {
    position: relative;
    width: 100%;
  }
  
  .select__trigger {
    width: 100%;
    padding: 6px 28px 6px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 0.9em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s ease;
    text-align: left;
    
    &:hover:not(.select__trigger--disabled) {
      border-color: var(--accent);
      background: var(--bg-light);
    }
    
    &:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
    }
    
    &.select__trigger--open {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.2);
    }
    
    &.select__trigger--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .select__value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--accent);
    font-weight: 600;
    
    &.select__value--placeholder {
      color: var(--muted);
      font-weight: 400;
    }
  }
  
  .select__arrow {
    flex-shrink: 0;
    margin-left: 6px;
    font-size: 0.7em;
    color: var(--muted);
    transition: transform 0.2s ease;
    
    .select__trigger--open & {
      transform: rotate(180deg);
    }
  }
  
  .select__dropdown {
    position: fixed;
    background: var(--card);
    border: 1px solid var(--accent);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 99999;
    max-height: 350px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .select__search {
    padding: 8px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-dark);
  }
  
  .select__search-icon {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 0.9em;
  }
  
  .select__search-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 0.9em;
    outline: none;
    
    &::placeholder {
      color: var(--muted);
    }
  }
  
  .select__search-clear {
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
    font-size: 0.8em;
    
    &:hover {
      background: var(--border);
      color: var(--text);
    }
  }
  
  .select__options {
    flex: 1;
    overflow-y: auto;
    max-height: 280px;
    
    &::-webkit-scrollbar {
      width: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: var(--bg-dark);
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 4px;
      
      &:hover {
        background: var(--muted);
      }
    }
  }
  
  .select__option {
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 0.9em;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    &:hover {
      background: var(--bg-light);
    }
    
    &.select__option--selected {
      background: var(--accent);
      color: var(--bg-dark);
      font-weight: 600;
      
      .select__option-badge {
        background: rgba(0, 0, 0, 0.2);
        color: white;
      }
    }
  }
  
  .select__option-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .select__option-badge {
    flex-shrink: 0;
    margin-left: 8px;
    padding: 2px 8px;
    background: rgba(237, 174, 73, 0.2);
    border-radius: 12px;
    color: var(--accent);
    font-size: 0.75em;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
  }
  
  .select__no-results {
    padding: 20px 12px;
    text-align: center;
    color: var(--muted);
    font-size: 0.9em;
  }
</style>
