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
    <button class="toast__close" on:click={dismiss} aria-label="Dismiss" title="Dismiss">×</button>
    <div class="toast__icon">{icons[type]}</div>
    <div class="toast__content">
      <p class="toast__message">{message}</p>
      {#if action}
        <button class="toast__action" on:click={handleAction}>{action.label}</button>
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .toast {
    position: relative;
    min-width: 300px;
    max-width: 500px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 0;
    padding: 16px;
    padding-top: 16px;
    padding-right: 40px;
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
    overflow: visible;
    
    &.visible {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .toast.type-success {
    border-color: var(--success);
  }
  
  .toast.type-success .toast__icon {
    color: var(--success);
  }
  
  .toast.type-error {
    border-color: var(--danger);
  }
  
  .toast.type-error .toast__icon {
    color: var(--danger);
  }
  
  .toast.type-warning {
    border-color: var(--warning);
  }
  
  .toast.type-warning .toast__icon {
    color: var(--warning);
  }
  
  .toast.type-info {
    border-color: var(--info);
  }
  
  .toast.type-info .toast__icon {
    color: var(--info);
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
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    font-size: 1.5em;
    font-weight: bold;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
    z-index: 1000;
    border-radius: 2px;
    
    &:hover {
      color: var(--text);
      background: rgba(0, 0, 0, 0.4);
      border-color: var(--border-light);
      transform: scale(1.1);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
</style>

