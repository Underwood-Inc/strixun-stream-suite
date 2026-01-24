<script lang="ts">
  /**
   * Navigation Component
   * 
   * Tab navigation for different pages using the hash router.
   * 
   * Features:
   * - Roman numeral indicators
   * - Connection requirement awareness
   * - Disabled state with tooltips
   * - Particle effects on click
   * - Active page highlighting
   */
  
  import { connected } from '../../stores/connection';
  import { domInterferenceDetected } from '../../stores/dom-interference';
  import { celebrateClick } from '../../utils/particles';
  import Tooltip from './Tooltip.svelte';
  import { animate, stagger } from '../../core/animations';
  import { StatusFlair } from '@strixun/status-flair';
  
  // Router imports
  import { navigate, currentPath } from '../../router';
  import { getNavRoutes, type AppRoute } from '../../router/routes';
  
  // Get navigation routes from centralized config
  const navRoutes = getNavRoutes();
  
  // Pages restricted when DOM interference is detected
  const RESTRICTED_PATHS_ON_INTERFERENCE = ['/sources', '/text-cycler', '/swaps', '/layouts', '/chat', '/url-shortener'];
  
  /**
   * Handle tab click - navigate via router
   * Router guards will handle auth/connection checks
   */
  function handleTabClick(e: MouseEvent, route: AppRoute): void {
    e.preventDefault();
    e.stopPropagation();
    
    // Show particle effect
    try {
      celebrateClick(e.currentTarget as HTMLElement);
    } catch (err) {
      // Ignore particle errors
      console.warn('[Navigation] Particle effect failed:', err);
    }
    
    // Navigate via router - guards will handle protection
    navigate(route.path);
  }
  
  /**
   * Check if a route is disabled based on current state
   */
  function isRouteDisabled(route: AppRoute): boolean {
    // WIP routes are always disabled (in active development, not ready for use)
    if (route.isWip) {
      return true;
    }
    
    // Check DOM interference for restricted paths
    if ($domInterferenceDetected && RESTRICTED_PATHS_ON_INTERFERENCE.includes(route.path)) {
      return true;
    }
    
    // Check connection requirement
    if (route.requiresConnection && !$connected) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Get rich tooltip content for a route
   * Combines route label, flair info, and disabled reasons into structured HTML
   */
  function getTooltipContent(route: AppRoute): string {
    const parts: string[] = [];
    const isDisabled = isRouteDisabled(route);
    const hasDOMInterference = $domInterferenceDetected && RESTRICTED_PATHS_ON_INTERFERENCE.includes(route.path);
    const needsConnection = route.requiresConnection && !$connected;
    
    // Title section with route label and description
    const description = route.meta?.description || '';
    parts.push(`<div class="nav-tooltip__header">
      <strong class="nav-tooltip__title">${route.label}</strong>
      ${description ? `<span class="nav-tooltip__description">${description}</span>` : ''}
    </div>`);
    
    // Flair section - shows special status (in-testing, WIP)
    if (route.inTesting || route.isWip) {
      const flairType = route.isWip ? 'wip' : 'in-testing';
      const flairLabel = route.isWip ? 'Work in Progress' : 'In Testing';
      const flairIcon = route.isWip ? '★' : '⊕';
      const flairMessage = route.isWip 
        ? 'This feature is incomplete and still in active development'
        : 'This feature is currently in testing phase and may have issues';
      
      parts.push(`<div class="nav-tooltip__flair nav-tooltip__flair--${flairType}">
        <span class="nav-tooltip__flair-icon">${flairIcon}</span>
        <span class="nav-tooltip__flair-label">${flairLabel}</span>
        <span class="nav-tooltip__flair-message">${flairMessage}</span>
      </div>`);
    }
    
    // Disabled reason section - shows why the route is currently inaccessible
    if (isDisabled) {
      let disabledIcon = '⚠';
      let disabledLabel = 'Unavailable';
      let disabledMessage = '';
      
      if (hasDOMInterference) {
        disabledIcon = '✗';
        disabledLabel = 'Restricted';
        disabledMessage = 'Disabled due to detected DOM interference from an extension or script';
      } else if (route.isWip) {
        disabledIcon = '↻';
        disabledLabel = 'Not Ready';
        disabledMessage = 'This feature is not yet ready for use';
      } else if (needsConnection) {
        disabledIcon = '⇄';
        disabledLabel = 'Connection Required';
        disabledMessage = route.disabledReason || 'Connect to OBS first to use this feature';
      }
      
      if (disabledMessage) {
        parts.push(`<div class="nav-tooltip__disabled">
          <span class="nav-tooltip__disabled-icon">${disabledIcon}</span>
          <span class="nav-tooltip__disabled-label">${disabledLabel}</span>
          <span class="nav-tooltip__disabled-message">${disabledMessage}</span>
        </div>`);
      }
    }
    
    return `<div class="nav-tooltip">${parts.join('')}</div>`;
  }
  
  /**
   * Get tooltip level for a route
   */
  function getTooltipLevel(route: AppRoute): 'error' | 'warning' | 'info' | 'log' {
    if ($domInterferenceDetected && RESTRICTED_PATHS_ON_INTERFERENCE.includes(route.path)) {
      return 'error';
    }
    
    if (route.inTesting) {
      return 'info';
    }
    
    if (route.isWip || (route.requiresConnection && !$connected)) {
      return 'warning';
    }
    
    return 'log';
  }
</script>

<nav class="tabs" use:stagger={{ preset: 'slideDown', stagger: 50, config: { duration: 250 } }}>
  {#each navRoutes as route}
    {@const isDisabled = isRouteDisabled(route)}
    {@const isActive = $currentPath === route.path && !isDisabled && !route.isWip}
    {@const statusFlair = route.isWip ? 'wip' : (route.inTesting ? 'in-testing' : null)}
    <Tooltip 
      text={getTooltipContent(route)} 
      position="bottom" 
      delay={0}
      level={getTooltipLevel(route)}
    >
      <StatusFlair status={statusFlair}>
        <button
          class="tab"
          class:active={isActive}
          class:disabled={isDisabled}
          use:animate={{
            preset: isActive ? 'scaleIn' : 'none',
            duration: 200,
            trigger: 'change',
            id: `nav-tab-${route.path}`,
            enabled: isActive
          }}
          on:click={(e) => handleTabClick(e, route)}
        >
          {#if route.numeral}
            <span class="tab__numeral">{route.numeral}</span>
          {/if}
          <span class="tab__label">{route.label}</span>
        </button>
      </StatusFlair>
    </Tooltip>
  {/each}
</nav>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .tabs {
    display: flex;
    gap: 6px;
    padding: 8px;
    background: var(--bg-dark);
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
    overflow-y: visible;
    @include gpu-accelerated;
    @include scrollbar(6px);
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

  // Status flairs are now handled by StatusFlair component
  // Base state for in-testing tabs (always visible, not just on hover)
  .tabs :global(.status-flair--in-testing > .tab) {
    border-color: var(--info);
    border-width: 2px;
    background: var(--card);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.08),
      rgba(100, 149, 237, 0.08) 6px,
      rgba(100, 149, 237, 0.12) 6px,
      rgba(100, 149, 237, 0.12) 12px
    );
  }

  // Base state for WIP tabs (always visible)
  .tabs :global(.status-flair--wip > .tab) {
    border-color: #ff8c00;
    border-width: 2px;
    background: var(--card);
    background-image: repeating-linear-gradient(
      135deg,
      rgba(255, 140, 0, 0.1),
      rgba(255, 140, 0, 0.1) 4px,
      rgba(255, 140, 0, 0.15) 4px,
      rgba(255, 140, 0, 0.15) 8px
    );
  }

  // Hover state for in-testing tabs
  .tabs :global(.status-flair--in-testing > .tab):hover:not(.disabled):not(.active) {
    border-color: var(--info);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.12),
      rgba(100, 149, 237, 0.12) 6px,
      rgba(100, 149, 237, 0.16) 6px,
      rgba(100, 149, 237, 0.16) 12px
    );
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 4px 0 var(--info);
  }

  // Active state overrides for in-testing status
  .tabs :global(.status-flair--in-testing > .tab.active) {
    background: var(--accent);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.15),
      rgba(100, 149, 237, 0.15) 6px,
      rgba(100, 149, 237, 0.2) 6px,
      rgba(100, 149, 237, 0.2) 12px
    );
    border-color: var(--info);
  }

  // Disabled state for in-testing tabs - preserve flair styling but dimmed
  .tabs :global(.status-flair--in-testing > .tab.disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: var(--info);
    background: var(--card);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.05),
      rgba(100, 149, 237, 0.05) 6px,
      rgba(100, 149, 237, 0.08) 6px,
      rgba(100, 149, 237, 0.08) 12px
    );
    box-shadow: 0 1px 0 var(--info);
    color: var(--text-secondary);
  }

  .tabs :global(.status-flair--in-testing > .tab.disabled:hover) {
    transform: none;
    background: var(--card);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.05),
      rgba(100, 149, 237, 0.05) 6px,
      rgba(100, 149, 237, 0.08) 6px,
      rgba(100, 149, 237, 0.08) 12px
    );
    border-color: var(--info);
  }

  // Disabled state for WIP tabs - preserve orange flair styling but dimmed
  .tabs :global(.status-flair--wip > .tab.disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: #ff8c00;
    background: var(--card);
    background-image: repeating-linear-gradient(
      135deg,
      rgba(255, 140, 0, 0.06),
      rgba(255, 140, 0, 0.06) 4px,
      rgba(255, 140, 0, 0.1) 4px,
      rgba(255, 140, 0, 0.1) 8px
    );
    box-shadow: 0 1px 0 #ff8c00;
    color: var(--text-secondary);
  }

  .tabs :global(.status-flair--wip > .tab.disabled:hover) {
    transform: none;
    background: var(--card);
    background-image: repeating-linear-gradient(
      135deg,
      rgba(255, 140, 0, 0.06),
      rgba(255, 140, 0, 0.06) 4px,
      rgba(255, 140, 0, 0.1) 4px,
      rgba(255, 140, 0, 0.1) 8px
    );
    border-color: #ff8c00;
  }

  // ========== Rich Tooltip Styles (Global - renders in portal) ==========
  :global(.nav-tooltip) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
  }

  :global(.nav-tooltip__header) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  :global(.nav-tooltip__title) {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text, #fff);
    letter-spacing: 0.5px;
  }

  :global(.nav-tooltip__description) {
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }

  :global(.nav-tooltip__flair) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
  }

  :global(.nav-tooltip__flair--in-testing) {
    border-left: 3px solid var(--info, #6495ed);
    background: rgba(100, 149, 237, 0.1);
  }

  :global(.nav-tooltip__flair--wip) {
    border-left: 3px solid #ff8c00;
    background: rgba(255, 140, 0, 0.1);
  }

  :global(.nav-tooltip__flair-icon) {
    display: none;
  }

  :global(.nav-tooltip__flair-label) {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text, #fff);
  }

  :global(.nav-tooltip__flair--in-testing .nav-tooltip__flair-label) {
    color: var(--info, #6495ed);
  }

  :global(.nav-tooltip__flair--wip .nav-tooltip__flair-label) {
    color: #ff8c00;
  }

  :global(.nav-tooltip__flair-message) {
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }

  :global(.nav-tooltip__disabled) {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 6px;
    background: rgba(234, 43, 31, 0.08);
    border-left: 3px solid var(--danger, #ea2b1f);
  }

  :global(.nav-tooltip__disabled-icon) {
    display: none;
  }

  :global(.nav-tooltip__disabled-label) {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--danger, #ea2b1f);
  }

  :global(.nav-tooltip__disabled-message) {
    font-size: 0.8rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }

  // When only header exists (no flair, not disabled), remove bottom border
  :global(.nav-tooltip__header:only-child) {
    padding-bottom: 0;
    border-bottom: none;
  }
</style>
