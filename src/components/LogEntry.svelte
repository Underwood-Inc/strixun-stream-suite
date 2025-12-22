<script lang="ts">
  /**
   * Log Entry Component
   * 
   * Individual log entry with color coding, flairs, and animations
   */
  
  import type { LogEntry } from '../stores/activity-log';
  
  export let entry: LogEntry;
  export let index: number = 0;
  
  let isHovered = false;
  
  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  function copyMessage(): void {
    navigator.clipboard.writeText(entry.message).then(() => {
      // Visual feedback could be added here
    });
  }
  
  function getTypeIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  }
</script>

<div 
  class="log-entry log-entry--{entry.type}" 
  class:hovered={isHovered}
  style="--index: {index}"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  role="log"
>
  <div class="log-entry__icon">
    {entry.icon || getTypeIcon(entry.type)}
  </div>
  
  <div class="log-entry__content">
    <div class="log-entry__header">
      <span class="log-entry__time" title={entry.timestamp.toISOString()}>
        {formatTime(entry.timestamp)}
      </span>
      {#if entry.flair}
        <span class="log-entry__flair log-entry__flair--{entry.type}">
          {entry.flair}
        </span>
      {/if}
      <button 
        class="log-entry__copy"
        on:click={copyMessage}
        title="Copy message"
        aria-label="Copy message"
      >
        📋
      </button>
    </div>
    <div class="log-entry__text">
      {entry.message}
    </div>
  </div>
</div>

<style lang="scss">
  .log-entry {
    display: flex;
    gap: 10px;
    padding: 8px 12px;
    margin-bottom: 4px;
    border-radius: 6px;
    border-left: 3px solid transparent;
    background: var(--bg-dark);
    transition: all 0.2s ease;
    animation: slide-in 0.3s ease;
    animation-delay: calc(var(--index) * 0.02s);
    animation-fill-mode: both;
    
    &:hover {
      background: var(--border);
      transform: translateX(2px);
      
      .log-entry__copy {
        opacity: 1;
      }
    }
    
    &__icon {
      font-size: 1.1em;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
      opacity: 0.8;
    }
    
    &__content {
      flex: 1;
      min-width: 0;
    }
    
    &__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    
    &__time {
      font-family: 'Courier New', monospace;
      font-size: 0.75em;
      color: var(--muted);
      white-space: nowrap;
    }
    
    &__flair {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.7em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      
      &--success {
        background: rgba(40, 167, 69, 0.2);
        color: var(--success);
        border: 1px solid var(--success);
      }
      
      &--error {
        background: rgba(234, 43, 31, 0.2);
        color: var(--danger);
        border: 1px solid var(--danger);
      }
      
      &--warning {
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
        border: 1px solid #ffc107;
      }
      
      &--info {
        background: rgba(100, 149, 237, 0.2);
        color: var(--info);
        border: 1px solid var(--info);
      }
      
      &--debug {
        background: rgba(128, 128, 128, 0.2);
        color: var(--muted);
        border: 1px solid var(--muted);
      }
    }
    
    &__copy {
      background: transparent;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 0.85em;
      opacity: 0;
      transition: opacity 0.2s, color 0.2s;
      margin-left: auto;
      
      &:hover {
        color: var(--text);
      }
    }
    
    &__text {
      font-size: 0.9em;
      color: var(--text);
      line-height: 1.4;
      word-wrap: break-word;
    }
    
    // Type-specific styling
    &--success {
      border-left-color: var(--success);
      background: rgba(40, 167, 69, 0.05);
      
      .log-entry__text {
        color: var(--success);
      }
    }
    
    &--error {
      border-left-color: var(--danger);
      background: rgba(234, 43, 31, 0.05);
      
      .log-entry__text {
        color: var(--danger);
      }
    }
    
    &--warning {
      border-left-color: #ffc107;
      background: rgba(255, 193, 7, 0.05);
      
      .log-entry__text {
        color: #ffc107;
      }
    }
    
    &--info {
      border-left-color: var(--info);
      background: rgba(100, 149, 237, 0.05);
      
      .log-entry__text {
        color: var(--info);
      }
    }
    
    &--debug {
      border-left-color: var(--muted);
      background: rgba(128, 128, 128, 0.05);
      
      .log-entry__text {
        color: var(--muted);
      }
    }
  }
  
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>

