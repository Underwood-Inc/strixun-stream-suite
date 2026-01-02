<script lang="ts">
  /**
   * Toast Component
   * 
   * Individual toast notification item.
   * Part of the agnostic UI component library.
   */
  
  import { onMount } from 'svelte';
  import type { Toast as ToastType, ToastAction } from '../../stores/toast-queue';
  import Tooltip from '../Tooltip.svelte';
  
  export let toast: ToastType;
  export let onDismiss: (id: string) => void;
  export let index: number = 0;
  export let inOverflow: boolean = false;
  export let overflowIndex: number = 0;
  export let showCloseButton: boolean = true; // Allow disabling close button (e.g., in alerts panel)
  export let showCount: boolean = true; // Allow disabling count indicator (e.g., in alerts panel)
  
  let mounted = false;
  let visible = false;
  
  onMount(() => {
    mounted = true;
    // Small delay for smooth entrance animation
    setTimeout(() => visible = true, 10);
  });
  
  function handleDismiss(): void {
    // Prevent dismissal if close button is disabled
    if (!showCloseButton) return;
    
    visible = false;
    setTimeout(() => {
      if (onDismiss) {
        onDismiss(toast.id);
      }
    }, 300);
  }
  
  function handleAction(): void {
    if (toast.action) {
      toast.action.handler();
      if (!toast.persistent) {
        handleDismiss();
      }
    }
  }
  
  $: hasAction = !!toast.action;
  
  // Default icons for each toast type
  const defaultIcons = {
    success: '',
    error: '',
    info: 'ℹ',
    warning: ''
  };
  
  // Default labels for each toast type
  const defaultLabels = {
    success: 'Success',
    error: 'Error',
    info: 'Information',
    warning: 'Warning'
  };
  
  $: icon = toast.icon || defaultIcons[toast.type || 'info'];
  $: label = toast.title || defaultLabels[toast.type || 'info'];
</script>

{#if mounted}
  <div
    class="toast"
    class:visible
    class:toast--overflow={inOverflow}
    class:toast--success={toast.type === 'success'}
    class:toast--error={toast.type === 'error'}
    class:toast--warning={toast.type === 'warning'}
    class:toast--info={toast.type === 'info'}
    class:toast--persistent={toast.persistent}
    role="alert"
    aria-live="polite"
    style="--toast-index: {index}; --overflow-index: {overflowIndex};"
  >
    <!-- Header Section -->
    <div class="toast__header">
      <div class="toast__header-content">
        <div class="toast__icon">{icon}</div>
        <div class="toast__title">{label}</div>
      </div>
      {#if showCloseButton}
        <Tooltip text="Dismiss" position="left">
          <button 
            class="toast__close" 
            on:click={handleDismiss} 
            aria-label="Dismiss"
          >
            ×
          </button>
        </Tooltip>
      {/if}
    </div>
    
    <!-- Body/Content Section -->
    <div class="toast__body">
      <div class="toast__message-row">
        <p class="toast__message">{toast.message}</p>
        {#if showCount && toast.count && toast.count > 1}
          <Tooltip text="This message appeared {toast.count} times" position="top">
            <span class="toast__count">
              x{toast.count}
            </span>
          </Tooltip>
        {/if}
      </div>
    </div>
    
    <!-- Action Button Area -->
    {#if hasAction}
      <div class="toast__actions">
        <button class="toast__action" on:click={handleAction}>
          {toast.action.label}
        </button>
      </div>
    {/if}
    
    <!-- Footer Section (for future use) -->
    <div class="toast__footer"></div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/variables' as *;
  @use '@styles/mixins' as *;
  @use '@styles/animations' as *;
  
  .toast {
    position: relative;
    min-width: 200px;
    max-width: 350px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0;
    padding: 8px 12px 8px 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    opacity: 0;
    transform: translateX(400px);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.3s ease,
                border-color 0.2s ease;
    box-sizing: border-box;
    @include gpu-accelerated;
    
    &.visible {
      transform: translateX(0);
      opacity: 1;
    }
    
    // Type variants
    &.toast--success {
      border-color: var(--success);
      border-width: 1px;
    }
    
    &.toast--error {
      border-color: var(--danger);
      border-width: 2px;
      background-image: repeating-linear-gradient(
        -45deg,
        rgba(234, 43, 31, 0.1),
        rgba(234, 43, 31, 0.1) 6px,
        rgba(234, 43, 31, 0.15) 6px,
        rgba(234, 43, 31, 0.15) 12px
      );
    }
    
    &.toast--warning {
      border-color: #ff8c00;
      border-width: 2px;
      background-image: repeating-linear-gradient(
        135deg,
        rgba(255, 140, 0, 0.1),
        rgba(255, 140, 0, 0.1) 4px,
        rgba(255, 140, 0, 0.15) 4px,
        rgba(255, 140, 0, 0.15) 8px
      );
    }
    
    &.toast--info {
      border-color: var(--info);
      border-width: 2px;
      background-image: repeating-linear-gradient(
        45deg,
        var(--card),
        var(--card) 8px,
        rgba(100, 149, 237, 0.08) 8px,
        rgba(100, 149, 237, 0.08) 16px
      );
    }
    
    // Overflow (3D deck) styling
    &.toast--overflow {
      position: absolute;
      transform-style: preserve-3d;
      transform: translateX(400px) 
                 rotateY(calc(var(--overflow-index) * 3deg))
                 translateZ(calc(var(--overflow-index) * -15px))
                 scale(calc(1 - var(--overflow-index) * 0.08));
      opacity: calc(1 - var(--overflow-index) * 0.2);
      pointer-events: auto;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.4s ease;
      
      &.visible {
        transform: translateX(calc(400px - var(--overflow-index) * 50px))
                   rotateY(calc(35deg - var(--overflow-index) * 1.5deg))
                   translateZ(calc(var(--overflow-index) * -15px))
                   scale(calc(1 - var(--overflow-index) * 0.08));
      }
    }
  }
  
  // Header Section
  .toast__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    padding-right: 28px; /* Extra padding for close button to prevent border clipping */
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  
  .toast__header-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    padding-right: 4px; /* Small gap between content and close button */
  }
  
  .toast__icon {
    font-size: 1.3em;
    line-height: 1;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .toast--success .toast__icon {
    color: var(--success);
  }
  
  .toast--error .toast__icon {
    color: var(--danger);
  }
  
  .toast--warning .toast__icon {
    color: #ff8c00;
  }
  
  .toast--info .toast__icon {
    color: var(--info);
  }
  
  .toast__title {
    font-weight: 600;
    font-size: 0.85em;
    color: var(--text);
    margin: 0;
    line-height: 1.3;
    flex: 1;
  }
  
  // Tooltip wrapper in header should not interfere with close button positioning
  .toast__header :global(.tooltip-wrapper) {
    position: absolute;
    top: 0;
    right: 0;
    display: block;
    margin: 0;
    padding: 0;
    z-index: 1;
  }
  
  .toast__close {
    position: relative;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    font-size: 1.2em;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
    flex-shrink: 0;
    z-index: 2;
    margin-top: -2px; /* Slight adjustment to align with title text */
    
    &:hover {
      color: var(--text);
      transform: scale(1.2);
    }
  }
  
  // Body/Content Section
  .toast__body {
    flex: 1;
    min-height: 0;
    margin-bottom: 8px;
  }
  
  .toast__message-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  
  .toast__message {
    margin: 0;
    color: var(--text);
    font-size: 0.85em;
    line-height: 1.4;
    flex: 1;
  }
  
  .toast__count {
    font-size: 0.75em;
    color: var(--text-secondary);
    background: var(--border);
    padding: 2px 6px;
    border-radius: 0;
    font-weight: 600;
    flex-shrink: 0;
    cursor: help;
    
    &:hover {
      background: var(--border-light);
      color: var(--text);
    }
  }
  
  // Action Button Area
  .toast__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    margin-bottom: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
  }
  
  .toast__action {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 0;
    cursor: pointer;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    transition: all 0.1s;
    
    &:hover {
      background: var(--accent);
      color: #000;
      transform: translateY(-1px);
    }
    
    &:active {
      transform: translateY(1px);
    }
  }
  
  // Footer Section (for future use)
  .toast__footer {
    min-height: 0;
    height: 0;
  }
</style>

