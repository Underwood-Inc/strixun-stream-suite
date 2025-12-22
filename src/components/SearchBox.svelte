<script lang="ts">
  /**
   * SearchBox Component
   * 
   * Agnostic, reusable search input component that can filter any container.
   * Loosely coupled - accepts configuration via props, no hard dependencies.
   * 
   * @example
   * <SearchBox
   *   inputId="mySearch"
   *   placeholder="Search items..."
   *   containerId="myContainer"
   *   itemSelector=".item"
   *   textSelector=".name"
   *   onFilter={(query, visible, total) => console.log(query)}
   * />
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  
  // Props
  export let inputId: string;
  export let placeholder: string = 'Search...';
  export let containerId: string | null = null;
  export let containerElement: HTMLElement | null = null;
  export let itemSelector: string = '.log-entry, .source-item, .config-item, .script-card';
  export let textSelector: string = '.log-entry__text, .name, .script-name, h3, h4';
  export let minChars: number = 1;
  export let debounceMs: number = 150;
  export let showCount: boolean = false;
  export let onFilter: ((query: string, visible: number, total: number) => void) | null = null;
  
  // Internal state
  let searchQuery = writable('');
  let inputElement: HTMLInputElement;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Get container element
  function getContainer(): HTMLElement | null {
    if (containerElement) return containerElement;
    if (containerId) return document.getElementById(containerId);
    return null;
  }
  
  // Perform search
  function performSearch(query: string): void {
    const container = getContainer();
    if (!container) return;
    
    const items = container.querySelectorAll(itemSelector);
    const q = query.toLowerCase().trim();
    let visibleCount = 0;
    const totalCount = items.length;
    
    items.forEach((item) => {
      const element = item as HTMLElement;
      
      // Remove old highlights
      element.querySelectorAll('.search-highlight').forEach((h) => {
        const parent = h.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(h.textContent || ''), h);
          parent.normalize();
        }
      });
      
      if (!q || q.length < minChars) {
        element.classList.remove('search-hidden');
        visibleCount++;
        return;
      }
      
      // Get text content
      let text = '';
      if (textSelector) {
        const textEls = element.querySelectorAll(textSelector);
        textEls.forEach((el) => {
          text += ' ' + (el.textContent || '');
        });
      }
      text = text || element.textContent || '';
      text = text.toLowerCase();
      
      if (text.includes(q)) {
        element.classList.remove('search-hidden');
        visibleCount++;
        
        // Highlight matching text
        if (textSelector) {
          const textEl = element.querySelector(textSelector) as HTMLElement | null;
          if (textEl) {
            const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            textEl.innerHTML = (textEl.textContent || '').replace(regex, '<span class="search-highlight">$1</span>');
          }
        }
      } else {
        element.classList.add('search-hidden');
      }
    });
    
    // Update count badge if enabled
    if (showCount && q.length >= minChars) {
      updateCountBadge(visibleCount, totalCount);
    } else {
      removeCountBadge();
    }
    
    // Show/hide no results message
    updateNoResults(container, visibleCount, q.length >= minChars);
    
    // Call callback if provided
    if (onFilter) {
      onFilter(q, visibleCount, totalCount);
    }
  }
  
  // Debounced search handler
  function handleInput(): void {
    const query = inputElement.value;
    searchQuery.set(query);
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
      performSearch(query);
      debounceTimer = null;
    }, debounceMs);
  }
  
  // Clear search
  function clearSearch(): void {
    inputElement.value = '';
    searchQuery.set('');
    performSearch('');
    inputElement.focus();
  }
  
  // Update count badge
  function updateCountBadge(visible: number, total: number): void {
    if (!showCount) return;
    
    const searchBox = inputElement.closest('.search-box') as HTMLElement | null;
    if (!searchBox) return;
    
    let badge = searchBox.querySelector('.search-box__count') as HTMLElement | null;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'search-box__count';
      searchBox.appendChild(badge);
    }
    badge.textContent = `${visible}/${total}`;
  }
  
  // Remove count badge
  function removeCountBadge(): void {
    if (!showCount) return;
    
    const searchBox = inputElement.closest('.search-box') as HTMLElement | null;
    if (searchBox) {
      searchBox.querySelector('.search-box__count')?.remove();
    }
  }
  
  // Update no results message
  function updateNoResults(container: HTMLElement, visible: number, hasQuery: boolean): void {
    let noResults = container.querySelector('.search-no-results') as HTMLElement | null;
    
    if (visible === 0 && hasQuery) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.className = 'search-no-results';
        noResults.textContent = 'No results found';
        container.appendChild(noResults);
      }
    } else if (noResults) {
      noResults.remove();
    }
  }
  
  // Reactive: perform search when query changes (for programmatic updates)
  $: {
    if (inputElement && $searchQuery !== inputElement.value) {
      // Only trigger if changed programmatically
      handleInput();
    }
  }
  
  onMount(() => {
    // Initial search to ensure state is correct
    if (inputElement) {
      performSearch(inputElement.value);
    }
  });
  
  onDestroy(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });
</script>

<div class="search-box">
  <span class="search-box__icon">🔍</span>
  <input
    type="text"
    class="search-box__input"
    id={inputId}
    placeholder={placeholder}
    bind:this={inputElement}
    on:input={handleInput}
  />
  {#if $searchQuery}
    <button
      class="search-box__clear"
      on:click={clearSearch}
      title="Clear search"
      type="button"
    >
      ✕
    </button>
  {/if}
</div>

<style lang="scss">
  @use '@styles/components/forms';
</style>

