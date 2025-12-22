<script lang="ts">
  /**
   * Toast Notification Component
   * 
   * Slide-in notifications with auto-dismiss and action buttons
   */
  
  import { onMount } from 'svelte';
  
  export let message: string;
  export let type: 'success' | 'error' | 'info' | 'warning' = 'info';
  export let duration: number = 3000;
  export let onDismiss: (() => void) | null = null;
  export let action: { label: string; handler: () => void } | null = null;
  
  let mounted = false;
  let visible = false;
  
  onMount(() => {
    mounted = true;
    setTimeout(() => visible = true, 10);
    
    if (duration > 0) {
      setTimeout(() => {
        dismiss();
      }, duration);
    }
  });
  
  function dismiss(): void {
    visible = false;
    setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 300);
  }
  
  function handleAction(): void {
    if (action) {
      action.handler();
      dismiss();
    }
  }
  
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };
</script>

{#if mounted}
  <div class="toast" class:visible class:type-success={type === 'success'} class:type-error={type === 'error'} class:type-warning={type === 'warning'} class:type-info={type === 'info'} role="alert">
    <div class="toast__icon">{icons[type]}</div>
    <div class="toast__content">
      <p class="toast__message">{message}</p>
      {#if action}
        <button class="toast__action" on:click={handleAction}>{action.label}</button>
      {/if}
    </div>
    <button class="toast__close" on:click={dismiss} aria-label="Dismiss">✕</button>
  </div>
{/if}

<style lang="scss">
  @use '../styles/animations' as *;
  
  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    min-width: 300px;
    max-width: 500px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 0;
    padding: 16px;
    box-shadow: 0 4px 0 var(--border);
    display: flex;
    gap: 12px;
    align-items: flex-start;
    z-index: 1000;
    transform: translateX(400px);
    opacity: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.3s ease;
    @include gpu-accelerated;
    
    &.visible {
      transform: translateX(0);
      opacity: 1;
    }
    
    &.type-success {
      border-color: var(--success);
      .toast__icon {
        color: var(--success);
      }
    }
    
    &.type-error {
      border-color: var(--danger);
      .toast__icon {
        color: var(--danger);
      }
    }
    
    &.type-warning {
      border-color: var(--warning);
      .toast__icon {
        color: var(--warning);
      }
    }
    
    &.type-info {
      border-color: var(--info);
      .toast__icon {
        color: var(--info);
      }
    }
  }
  
  .toast__icon {
    font-size: 1.5em;
    line-height: 1;
    flex-shrink: 0;
  }
  
  .toast__content {
    flex: 1;
    min-width: 0;
  }
  
  .toast__message {
    margin: 0 0 8px 0;
    color: var(--text);
    font-size: 0.9em;
    line-height: 1.4;
  }
  
  .toast__action {
    background: transparent;
    border: 2px solid var(--accent);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 0;
    cursor: pointer;
    font-size: 0.85em;
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
  
  .toast__close {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    font-size: 1.2em;
    transition: all 0.1s;
    flex-shrink: 0;
    
    &:hover {
      color: var(--text);
      transform: scale(1.2);
    }
  }
</style>

