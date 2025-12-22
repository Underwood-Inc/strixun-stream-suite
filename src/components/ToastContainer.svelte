<script lang="ts">
  /**
   * Toast Container Component
   * 
   * Renders all active toast notifications
   */
  
  import { toasts, dismissToast } from '../stores/toast';
  import Toast from './Toast.svelte';
</script>

<div class="toast-container">
  {#each $toasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      action={toast.action}
      onDismiss={() => dismissToast(toast.id)}
    />
  {/each}
</div>

<style lang="scss">
  .toast-container {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 1000;
    pointer-events: none;
    
    :global(.toast) {
      pointer-events: auto;
      margin-bottom: 12px;
    }
  }
</style>

