<script lang="ts">
  /**
   * Info Bar Component
   * 
   * Horizontal scrolling information bar showing high-level important information.
   * Positioned between header and navigation.
   * 
   * Features:
   * - Current scene display
   * - Horizontal scrolling for multiple info items
   * - Animated value updates
   * - Connection status awareness
   */
  
  import { connected, currentScene } from '../../stores/connection';
  import { animate } from '../../core/animations';
</script>

<div class="info-bar">
  <div class="info-bar__content">
    <div class="info-item">
      <span class="info-item__label">Current Scene:</span>
      {#if $connected && $currentScene}
        <span 
          class="info-item__value info-item__value--active"
          use:animate={{
            preset: 'pulse',
            duration: 400,
            easing: 'easeOutCubic',
            id: 'info-scene-value',
            trigger: 'change',
            enabled: $connected && $currentScene
          }}
        >
          {$currentScene}
        </span>
      {:else}
        <span class="info-item__value info-item__value--inactive">Not connected</span>
      {/if}
    </div>
    <!-- Future info items can be added here for horizontal scrolling -->
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .info-bar {
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    overflow-x: auto;
    overflow-y: hidden;
    @include gpu-accelerated;
    
    // Custom scrollbar styling (horizontal scrollbar - thinner)
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
      
      &:hover {
        background: var(--muted);
      }
    }
    
    &::-webkit-scrollbar-corner {
      background: transparent;
    }
    
    // Firefox scrollbar
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  
  .info-bar__content {
    display: flex;
    gap: 24px;
    align-items: center;
    min-width: max-content;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .info-item .info-item__label {
    color: var(--text-secondary);
    font-size: 0.85em;
    font-weight: 500;
  }
  
  .info-item .info-item__value {
    font-size: 0.9em;
    font-weight: 600;
  }
  
  .info-item .info-item__value--active {
    color: var(--accent);
  }
  
  .info-item .info-item__value--inactive {
    color: var(--muted);
    font-style: italic;
  }
</style>

