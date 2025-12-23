<script lang="ts">
  /**
   * Confirmation Modal Component
   * 
   * Reusable modal for confirming dangerous actions
   */
  
  import { animate } from '../../../core/animations';
  
  export let title: string = 'Confirm Action';
  export let message: string = 'Are you sure you want to proceed?';
  export let confirmLabel: string = 'Confirm';
  export let cancelLabel: string = 'Cancel';
  export let confirmVariant: 'danger' | 'primary' | 'accent' = 'danger';
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

<div 
  class="confirmation-modal-overlay" 
  on:click={onCancel} 
  role="button" 
  tabindex="0" 
  on:keydown={(e) => e.key === 'Escape' && onCancel()}
>
  <div 
    class="confirmation-modal" 
    on:click|stopPropagation 
    use:animate={{
      preset: 'scaleIn',
      duration: 300,
      easing: 'easeOutBack',
      id: 'confirmation-modal'
    }}
    role="dialog" 
    aria-labelledby="confirmation-title"
  >
    <div class="confirmation-header">
      <h2 id="confirmation-title">{title}</h2>
      <button class="close-btn" on:click={onCancel} aria-label="Close">×</button>
    </div>
    
    <div class="confirmation-content">
      <p class="confirmation-message">{message}</p>
      
      <div class="confirmation-actions">
        <button
          class="btn btn-cancel"
          on:click={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          class="btn btn-confirm"
          class:btn-confirm--danger={confirmVariant === 'danger'}
          class:btn-confirm--primary={confirmVariant === 'primary'}
          class:btn-confirm--accent={confirmVariant === 'accent'}
          on:click={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .confirmation-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    animation: fade-in 0.3s ease-out;
  }
  
  .confirmation-modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    @include gpu-accelerated;
  }
  
  .confirmation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid var(--border);
    
    h2 {
      margin: 0;
      font-size: 20px;
      color: var(--text);
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 32px;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
      
      &:hover {
        background: var(--bg-secondary);
        color: var(--text);
      }
    }
  }
  
  .confirmation-content {
    padding: 24px;
  }
  
  .confirmation-message {
    margin: 0 0 24px 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }
  
  .confirmation-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
  
  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    
    &.btn-cancel {
      background: var(--bg-secondary, var(--card));
      color: var(--text);
      border: 1px solid var(--border);
      
      &:hover {
        background: var(--card);
      }
    }
    
    &.btn-confirm {
      color: white;
      
      &.btn-confirm--danger {
        background: var(--danger);
        
        &:hover {
          background: var(--danger-dark, rgba(var(--danger-rgb, 255, 0, 0), 0.8));
        }
      }
      
      &.btn-confirm--primary {
        background: var(--primary, var(--accent));
        
        &:hover {
          background: var(--primary-dark, var(--accent-dark));
        }
      }
      
      &.btn-confirm--accent {
        background: var(--accent);
        color: #000;
        
        &:hover {
          background: var(--accent-dark);
        }
      }
    }
  }
</style>

