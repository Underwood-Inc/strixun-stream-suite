<script lang="ts">
  /**
   * Navigation Component
   * 
   * Tab navigation for different pages
   */
  
  import { connected } from '../stores/connection';
  import { currentPage } from '../stores/navigation';
  import { celebrateClick } from '../utils/particles';
  
  const tabs = [
    { id: 'dashboard', numeral: 'I', label: 'Dashboard', requiresConnection: false },
    { id: 'sources', numeral: 'II', label: 'Sources', requiresConnection: true },
    { id: 'text', numeral: 'III', label: 'Text Cycler', requiresConnection: true },
    { id: 'swaps', numeral: 'IV', label: 'Swaps', requiresConnection: true },
    { id: 'layouts', numeral: 'V', label: 'Layouts', requiresConnection: true },
    { id: 'scripts', numeral: 'VI', label: 'Script Manager', requiresConnection: false },
    { id: 'install', numeral: 'VII', label: 'Installer', requiresConnection: false },
    { id: 'setup', numeral: 'VIII', label: 'Setup', requiresConnection: false }
  ];
  
  function handleTabClick(e: MouseEvent, tabId: string, requiresConnection: boolean): void {
    e.preventDefault();
    e.stopPropagation();
    
    if (requiresConnection && !$connected) {
      if (window.App?.log) {
        window.App.log('Connect to OBS first to use this feature', 'error');
      }
      currentPage.set('setup');
      return;
    }
    
    try {
      celebrateClick(e.currentTarget as HTMLElement);
    } catch (err) {
      // Ignore particle errors
      console.warn('[Navigation] Particle effect failed:', err);
    }
    
    currentPage.set(tabId);
  }
</script>

<nav class="tabs">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={$currentPage === tab.id}
      class:disabled={tab.requiresConnection && !$connected}
      on:click={(e) => handleTabClick(e, tab.id, tab.requiresConnection)}
      title={tab.label}
    >
      <span class="tab__numeral">{tab.numeral}</span>
      <span class="tab__label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style lang="scss">
  @use '../styles/animations' as *;
  
  .tabs {
    display: flex;
    gap: 6px;
    padding: 8px;
    background: var(--bg-dark);
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
    @include gpu-accelerated;
    
    .tab {
      padding: 10px 16px;
      background: transparent;
      border: 2px solid var(--border);
      border-radius: 0;
      cursor: pointer;
      color: var(--text-secondary);
      transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.9em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 50px;
      position: relative;
      box-shadow: 0 2px 0 var(--border);
      @include ripple-effect(rgba(255, 255, 255, 0.1));
      
      &__numeral {
        font-variant-numeric: oldstyle-nums;
        font-weight: 600;
        letter-spacing: -0.5px;
        font-size: 0.85em;
      }
      
      &__label {
        display: none;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 0.75em;
        
        @media (min-width: 800px) {
          display: inline;
        }
      }
      
      // Staggered animation on mount
      animation: slide-down 0.3s ease-out backwards;
      @for $i from 1 through 8 {
        &:nth-child(#{$i}) {
          animation-delay: #{$i * 0.05}s;
        }
      }
      
      &:hover:not(.disabled):not(.active) {
        background: var(--card);
        color: var(--text);
        transform: translateY(-2px);
        box-shadow: 0 4px 0 var(--border);
        border-color: var(--border-light);
      }
      
      &.active {
        background: var(--accent);
        color: #000;
        font-weight: 700;
        border-color: var(--accent-dark);
        box-shadow: 0 4px 0 var(--accent-dark);
        transform: translateY(-1px);
        
        // Simple retro indicator line instead of glow
        &::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--accent);
        }
      }
      
      &:active:not(.disabled) {
        transform: translateY(1px);
        box-shadow: 0 2px 0 var(--border);
        
        &.active {
          box-shadow: 
            0 2px 0 var(--accent-dark),
            0 4px 0 rgba(0, 0, 0, 0.2);
        }
      }
      
      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: 0 1px 0 var(--border);
        
        &:hover {
          transform: none;
        }
      }
    }
  }
</style>

