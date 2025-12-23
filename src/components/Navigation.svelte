<script lang="ts">
  /**
   * Navigation Component
   * 
   * Tab navigation for different pages
   */
  
  import { connected } from '../stores/connection';
  import { currentPage } from '../stores/navigation';
  import { celebrateClick } from '../utils/particles';
  import Tooltip from './Tooltip.svelte';
  import { animate, stagger } from '../core/animations';
  
  const tabs = [
    { 
      id: 'dashboard', 
      numeral: 'I', 
      label: 'Dashboard', 
      requiresConnection: false,
      disabledReason: null
    },
    { 
      id: 'sources', 
      numeral: 'II', 
      label: 'Sources', 
      requiresConnection: true,
      disabledReason: 'Connect to OBS first to use this feature'
    },
    { 
      id: 'text', 
      numeral: 'III', 
      label: 'Text Cycler', 
      requiresConnection: true,
      disabledReason: 'Connect to OBS first to use this feature'
    },
    { 
      id: 'swaps', 
      numeral: 'IV', 
      label: 'Swaps', 
      requiresConnection: true,
      disabledReason: 'Connect to OBS first to use this feature'
    },
    { 
      id: 'layouts', 
      numeral: 'V', 
      label: 'Layouts', 
      requiresConnection: true,
      disabledReason: 'Connect to OBS first to use this feature'
    },
    { 
      id: 'notes', 
      numeral: 'VI', 
      label: 'Notes', 
      requiresConnection: false,
      disabledReason: null
    },
    { 
      id: 'scripts', 
      numeral: 'VII', 
      label: 'Script Manager', 
      requiresConnection: false,
      disabledReason: null
    },
    { 
      id: 'install', 
      numeral: 'VIII', 
      label: 'Installer', 
      requiresConnection: false,
      disabledReason: null
    },
    { 
      id: 'setup', 
      numeral: 'IX', 
      label: 'Setup', 
      requiresConnection: false,
      disabledReason: null
    }
  ];
  
  // Redirect away from disabled pages when connection is lost
  $: {
    const currentTab = tabs.find(t => t.id === $currentPage);
    if (currentTab && currentTab.requiresConnection && !$connected) {
      // Redirect to setup if we're on a disabled page
      currentPage.set('setup');
    }
  }
  
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

<nav class="tabs" use:stagger={{ preset: 'slideDown', stagger: 50, config: { duration: 250 } }}>
  {#each tabs as tab, index}
    {@const isDisabled = tab.requiresConnection && !$connected}
    {@const tooltipLevel = tab.requiresConnection && !$connected ? 'warning' : 'log'}
    {@const tooltipContent = tab.requiresConnection && !$connected && tab.disabledReason 
      ? `${tab.label}\n${tab.disabledReason}` 
      : tab.label}
    {@const isActive = $currentPage === tab.id && !isDisabled}
    <Tooltip 
      text={tooltipContent} 
      position="bottom" 
      delay={0}
      level={tooltipLevel}
    >
      <button
        class="tab"
        class:active={isActive}
        class:disabled={isDisabled}
        use:animate={{
          preset: isActive ? 'scaleIn' : 'none',
          duration: 200,
          trigger: 'change',
          id: `nav-tab-${tab.id}`,
          enabled: isActive
        }}
        on:click={(e) => handleTabClick(e, tab.id, tab.requiresConnection)}
      >
        <span class="tab__numeral">{tab.numeral}</span>
        <span class="tab__label">{tab.label}</span>
      </button>
    </Tooltip>
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
    overflow-y: visible;
    @include gpu-accelerated;
  }
  
  .tabs .tab {
    padding: 10px 16px;
    background: transparent;
    border: 2px solid var(--border);
    border-radius: 0;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.9em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 50px;
    position: relative;
    box-shadow: 0 2px 0 var(--border);
    @include ripple-effect(rgba(255, 255, 255, 0.1));
  }
  
  .tabs .tab .tab__numeral {
    font-variant-numeric: oldstyle-nums;
    font-weight: 600;
    letter-spacing: -0.5px;
    font-size: 0.85em;
  }
  
  .tabs .tab .tab__label {
    display: none;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.75em;
  }
  
  @media (min-width: 800px) {
    .tabs .tab .tab__label {
      display: inline;
    }
  }
  
  .tabs .tab:hover:not(.disabled):not(.active) {
    background: var(--card);
    color: var(--text);
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 4px 0 var(--border);
    border-color: var(--border-light);
  }
  
  .tabs .tab.active {
    background: var(--accent);
    color: #000;
    font-weight: 700;
    border-color: var(--accent-dark);
    box-shadow: 0 4px 0 var(--accent-dark);
    transform: translateY(-1px);
  }
  
  .tabs .tab.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent);
  }
  
  .tabs .tab:active:not(.disabled) {
    transform: translateY(1px);
    box-shadow: 0 2px 0 var(--border);
  }
  
  .tabs .tab:active:not(.disabled).active {
    box-shadow: 
      0 2px 0 var(--accent-dark),
      0 4px 0 rgba(0, 0, 0, 0.2);
  }
  
  .tabs .tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: 0 1px 0 var(--border);
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border);
  }
  
  .tabs .tab.disabled:hover {
    transform: none;
    background: transparent;
    border-color: var(--border);
  }
  
  // Ensure disabled state overrides active state
  .tabs .tab.disabled.active {
    background: transparent;
    color: var(--text-secondary);
    border-color: var(--border);
    box-shadow: 0 1px 0 var(--border);
    font-weight: normal;
  }
  
  .tabs .tab.disabled.active::after {
    display: none;
  }
</style>

