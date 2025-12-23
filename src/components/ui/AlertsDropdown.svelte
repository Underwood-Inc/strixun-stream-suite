<script lang="ts">
  /**
   * Alerts Dropdown Component
   * 
   * Displays all toasts from the current session in a dropdown.
   * Uses VirtualList for efficient rendering of large lists.
   * 
   * Part of the agnostic UI component library.
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { allToastsHistory } from '../../stores/toast-queue';
  import VirtualList from '../VirtualList.svelte';
  import Toast from './Toast.svelte';
  import Tooltip from '../Tooltip.svelte';
  
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
  
  export let open: boolean = false;
  export let onToggle: () => void;

  let dropdown: HTMLDivElement;
  let button: HTMLButtonElement;
  let portalContainer: HTMLDivElement | null = null;
  let header: HTMLDivElement;
  let content: HTMLDivElement;
  
  // Calculate available height for VirtualList (max-height - header height)
  const PANEL_MAX_HEIGHT = 500;
  let availableHeight = 400; // Default, will be calculated
  
  function handleClickOutside(event: MouseEvent): void {
    if (dropdown && !dropdown.contains(event.target as Node) && !button?.contains(event.target as Node)) {
      if (open) {
        onToggle();
      }
    }
  }
  
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  function updateDropdownPosition(): void {
    try {
      if (!dropdown || !button || !portalContainer) return;
      
      const buttonRect = button.getBoundingClientRect();
      if (!buttonRect) return;
      
      const spaceBelow = window.innerHeight - buttonRect.bottom - 8;
      const spaceAbove = buttonRect.top - 8;
      
      // Position dropdown below button by default
      let top = buttonRect.bottom + 8;
      let maxHeight = PANEL_MAX_HEIGHT;
      
      // If not enough space below, position above button
      if (spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow) {
        top = buttonRect.top - PANEL_MAX_HEIGHT - 8;
        maxHeight = Math.min(PANEL_MAX_HEIGHT, spaceAbove - 8);
      } else {
        maxHeight = Math.min(PANEL_MAX_HEIGHT, spaceBelow);
      }
      
      dropdown.style.top = `${top}px`;
      dropdown.style.right = `${window.innerWidth - buttonRect.right}px`;
      dropdown.style.maxHeight = `${maxHeight}px`;
      
      // Recalculate available height for content
      if (header) {
        const headerHeight = header.offsetHeight;
        availableHeight = Math.max(100, maxHeight - headerHeight);
      }
    } catch (error) {
      console.error('Error in updateDropdownPosition:', error);
    }
  }
  
  onMount(() => {
    // Create portal container at body level for dropdown
    portalContainer = document.createElement('div');
    portalContainer.id = 'alerts-dropdown-portal';
    portalContainer.style.position = 'fixed';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '100%';
    portalContainer.style.height = '100%';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '100001'; // Above toasts (99999)
    document.body.appendChild(portalContainer);
    
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
  });
  
  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', updateDropdownPosition);
    window.removeEventListener('scroll', updateDropdownPosition, true);
    
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
  
  // Update position when dropdown opens
  $: if (open && dropdown && button) {
    tick().then(() => {
      try {
        updateDropdownPosition();
      } catch (error) {
        console.error('Error updating dropdown position:', error);
      }
    });
  }
  
  // Safely calculate counts with error handling
  let unreadCount = 0;
  let totalCount = 0;
  
  $: {
    try {
      if ($allToastsHistory) {
        unreadCount = $allToastsHistory.filter(t => t && t.visible).length;
        totalCount = $allToastsHistory.length;
      } else {
        unreadCount = 0;
        totalCount = 0;
      }
    } catch (error) {
      console.error('Error calculating alert counts:', error);
      unreadCount = 0;
      totalCount = 0;
    }
  }
</script>

<div class="alerts-dropdown">
  <Tooltip text="View all alerts ({totalCount} total, {unreadCount} active)" position="bottom">
    <button
      bind:this={button}
      class="alerts-dropdown__trigger"
      class:alerts-dropdown__trigger--active={open}
      on:click={onToggle}
      aria-label="Alerts"
      aria-expanded={open}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {#if unreadCount > 0}
        <span class="alerts-dropdown__badge">{unreadCount}</span>
      {/if}
    </button>
  </Tooltip>
  
  {#if open && portalContainer}
    <div 
      bind:this={dropdown} 
      class="alerts-dropdown__panel"
      use:portal={portalContainer}
    >
      <div class="alerts-dropdown__header" bind:this={header}>
        <h3 class="alerts-dropdown__title">Alerts</h3>
        <span class="alerts-dropdown__count">{totalCount} total</span>
      </div>
      
      {#if $allToastsHistory && $allToastsHistory.length > 0}
        <div class="alerts-dropdown__content" bind:this={content}>
          <VirtualList
            items={$allToastsHistory.filter(item => item && item.id)}
            itemHeight={80}
            containerHeight={availableHeight}
            overscan={3}
          >
            <svelte:fragment let:item let:index>
              {#if item}
                <div class="alerts-dropdown__item" class:alerts-dropdown__item--dismissed={!item.visible}>
                  <div class="alerts-dropdown__item-header">
                    <span class="alerts-dropdown__item-time">{formatTime(item.createdAt || Date.now())}</span>
                    {#if item.count && item.count > 1}
                      <span class="alerts-dropdown__item-count">x{item.count}</span>
                    {/if}
                  </div>
                  <div class="alerts-dropdown__item-toast">
                    <Toast
                      toast={item}
                      index={index}
                      inOverflow={false}
                      overflowIndex={0}
                      showCloseButton={false}
                      onDismiss={() => {}}
                    />
                  </div>
                </div>
              {/if}
            </svelte:fragment>
          </VirtualList>
        </div>
      {:else}
        <div class="alerts-dropdown__empty">
          <p>No alerts yet</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../../styles/variables' as *;
  @use '../../styles/mixins' as *;
  
  .alerts-dropdown {
    position: relative;
    display: inline-block;
  }
  
  .alerts-dropdown__trigger {
    position: relative;
    background: transparent;
    border: 2px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
    box-shadow: 0 2px 0 var(--border);
    overflow: visible; // Allow badge to overflow
    
    &:hover {
      background: var(--border);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--border);
    }
    
    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 0 var(--border);
    }
    
    &.alerts-dropdown__trigger--active {
      background: var(--accent);
      border-color: var(--accent-dark);
      color: #000;
      box-shadow: 0 2px 0 var(--accent-dark);
    }
    
    svg {
      display: block;
    }
  }
  
  .alerts-dropdown__badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--danger);
    color: #fff;
    font-size: 0.7em;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 0;
    min-width: 18px;
    height: 18px;
    text-align: center;
    line-height: 1.2;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1;
  }
  
  .alerts-dropdown__panel {
    position: fixed;
    width: 400px;
    max-height: 500px;
    background: var(--card);
    border: 2px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 100001; // Above toasts (99999) - alerts panel is the exception
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }
  
  .alerts-dropdown__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    flex-shrink: 0;
  }
  
  .alerts-dropdown__title {
    margin: 0;
    font-size: 1em;
    font-weight: 600;
    color: var(--text);
  }
  
  .alerts-dropdown__count {
    font-size: 0.85em;
    color: var(--text-secondary);
  }
  
  .alerts-dropdown__content {
    flex: 1;
    overflow: hidden;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  
  .alerts-dropdown__item {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    
    &.alerts-dropdown__item--dismissed {
      opacity: 0.6;
    }
    
    &-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 0.75em;
      color: var(--text-secondary);
    }
    
    &-time {
      font-family: monospace;
    }
    
    &-count {
      background: var(--border);
      padding: 1px 4px;
      border-radius: 0;
      font-weight: 600;
    }
    
    &-toast {
      :global(.toast) {
        min-width: auto;
        max-width: 100%;
        margin: 0;
        transform: none;
        opacity: 1;
        position: relative;
      }
    }
  }
  
  .alerts-dropdown__empty {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
  }
</style>

