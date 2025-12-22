<script lang="ts">
  /**
   * Navigation Component
   * 
   * Tab navigation for different pages
   */
  
  import { currentPage } from '../stores/navigation';
  import { isReady } from '../stores/connection';
  import { celebrateClick } from '../utils/particles';
  
  const tabs = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard', requiresConnection: false },
    { id: 'sources', icon: '📦', label: 'Sources', requiresConnection: true },
    { id: 'text', icon: '📝', label: 'Text Cycler', requiresConnection: true },
    { id: 'swaps', icon: '🔄', label: 'Swaps', requiresConnection: true },
    { id: 'layouts', icon: '📐', label: 'Layouts', requiresConnection: true },
    { id: 'scripts', icon: '📜', label: 'Script Manager', requiresConnection: false },
    { id: 'install', icon: '📥', label: 'Installer', requiresConnection: false },
    { id: 'setup', icon: '⚙️', label: 'Setup', requiresConnection: false }
  ];
  
  function handleTabClick(e: MouseEvent, tabId: string, requiresConnection: boolean): void {
    if (requiresConnection && !$isReady) {
      if (window.App?.log) {
        window.App.log('Connect to OBS first to use this feature', 'error');
      }
      currentPage.set('setup');
      return;
    }
    celebrateClick(e.currentTarget as HTMLElement);
    currentPage.set(tabId);
  }
</script>

<nav class="tabs">
  {#each tabs as tab}
    <button
      class="tab"
      class:active={$currentPage === tab.id}
      class:disabled={tab.requiresConnection && !$isReady}
      on:click={(e) => handleTabClick(e, tab.id, tab.requiresConnection)}
      title={tab.label}
    >
      {tab.icon}
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
      font-size: 1.1em;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 50px;
      position: relative;
      box-shadow: 0 2px 0 var(--border);
      @include ripple-effect(rgba(255, 255, 255, 0.1));
      
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

