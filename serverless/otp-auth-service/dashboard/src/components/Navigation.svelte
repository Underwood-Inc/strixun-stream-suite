<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Tooltip from '@strixun/tooltip/Tooltip.svelte';
  import { StatusFlair } from '@strixun/status-flair';

  export let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' = 'dashboard';

  const dispatch = createEventDispatcher();

  const pages = [
    { 
      id: 'dashboard', 
      label: 'Dashboard',
      baseTooltip: 'Overview of your account information, API keys, and usage metrics',
      level: 'log' as const,
      status: 'in-testing' as 'wip' | 'in-testing' | 'beta' | 'alpha' | 'experimental' | 'deprecated' | 'coming-soon' | 'super-admin' | null
    },
    { 
      id: 'api-keys', 
      label: 'API Keys',
      baseTooltip: 'Create, manage, and revoke API keys for authenticating your requests',
      level: 'log' as const,
      status: 'in-testing' as 'wip' | 'in-testing' | 'beta' | 'alpha' | 'experimental' | 'deprecated' | 'coming-soon' | 'super-admin' | null
    },
    { 
      id: 'audit-logs', 
      label: 'Audit Logs',
      baseTooltip: 'View detailed logs of all API requests, authentication events, and security activities',
      level: 'info' as const,
      status: 'in-testing' as 'wip' | 'in-testing' | 'beta' | 'alpha' | 'experimental' | 'deprecated' | 'coming-soon' | 'super-admin' | null
    },
    { 
      id: 'analytics', 
      label: 'Analytics',
      baseTooltip: 'Track usage statistics, performance metrics, success rates, and trends over time',
      level: 'info' as const,
      status: 'in-testing' as 'wip' | 'in-testing' | 'beta' | 'alpha' | 'experimental' | 'deprecated' | 'coming-soon' | 'super-admin' | null
    }
  ] as const;

  // Generate tooltip content as formatted HTML with status header and description body
  function getTooltipContent(page: typeof pages[number]): string {
    let statusHeader = '';
    
    if (page.status === 'in-testing') {
      statusHeader = 'This feature is currently in testing';
    } else if (page.status === 'wip') {
      statusHeader = 'This feature is incomplete and still in progress';
    } else if (page.status === 'beta') {
      statusHeader = 'This feature is in beta and may have bugs or incomplete features';
    } else if (page.status === 'alpha') {
      statusHeader = 'This feature is in alpha and is experimental';
    } else if (page.status === 'experimental') {
      statusHeader = 'This feature is experimental and may change';
    } else if (page.status === 'deprecated') {
      statusHeader = 'This feature is deprecated and may be removed';
    } else if (page.status === 'coming-soon') {
      statusHeader = 'This feature is coming soon';
    } else if (page.status === 'super-admin') {
      statusHeader = 'This feature requires super admin privileges';
    }
    
    // Format as HTML with proper structure: header and body
    if (statusHeader) {
      return `<div class="tooltip-header">${statusHeader}</div><div class="tooltip-body">${page.baseTooltip}</div>`;
    }
    
    // No status - just return the base tooltip as plain text
    return page.baseTooltip;
  }

  function getTooltipLevel(page: typeof pages[number]): 'log' | 'info' | 'warning' | 'error' {
    if (page.status === 'in-testing') {
      return 'info';
    } else if (page.status === 'wip' || page.status === 'deprecated') {
      return 'warning';
    } else if (page.status === 'super-admin') {
      return 'warning';
    }
    return page.level;
  }

  function handleClick(page: typeof currentPage) {
    dispatch('navigate', page);
  }
</script>

<nav class="app-nav">
  <ul class="app-nav__list">
    {#each pages as page}
      <li class="app-nav__item">
        <Tooltip 
          text={getTooltipContent(page)} 
          position="bottom" 
          delay={0}
          level={getTooltipLevel(page)}
        >
          <StatusFlair status={page.status}>
            <button
              class="app-nav__link"
              class:active={currentPage === page.id}
              onclick={() => handleClick(page.id)}
            >
              {page.label}
            </button>
          </StatusFlair>
        </Tooltip>
      </li>
    {/each}
  </ul>
</nav>

<style lang="scss">
  @use '../../../../../shared-styles/mixins' as *;

  .app-nav {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .app-nav__list {
    display: flex;
    gap: var(--spacing-sm);
    list-style: none;
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
  }

  .app-nav__item {
    flex: 0 0 auto;
  }

  .app-nav__link {
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s;
    display: block;
    cursor: pointer;
  }

  .app-nav__link:hover:not(.active) {
    color: var(--text);
    background: var(--bg-dark);
  }

  .app-nav__link.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--bg-dark);
  }

  // Status flairs - base state is handled by StatusFlair component via shared mixin
  // We only add component-specific overrides for hover/active states

  // Hover state for in-testing tabs - mixin handles background-image, we adjust text color
  .app-nav :global(.status-flair--in-testing > .app-nav__link):hover:not(.active) {
    color: var(--text);
  }

  // Active state for in-testing tabs - preserve pattern with accent (component-specific override)
  .app-nav :global(.status-flair--in-testing > .app-nav__link.active) {
    background: var(--accent);
    background-image: repeating-linear-gradient(
      45deg,
      rgba(100, 149, 237, 0.15),
      rgba(100, 149, 237, 0.15) 6px,
      rgba(100, 149, 237, 0.2) 6px,
      rgba(100, 149, 237, 0.2) 12px
    );
    border-color: var(--info);
    color: #000;
  }

  // Tooltip content formatting - styles for structured tooltip content
  :global(.tooltip-content .tooltip-header) {
    font-weight: 600;
    color: var(--info, #6495ed);
    margin-bottom: 8px;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.tooltip-content .tooltip-body) {
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 0.875rem;
    line-height: 1.5;
  }

  // Adjust for different tooltip levels
  :global(.tooltip--warning .tooltip-content .tooltip-header) {
    color: #ff8c00;
  }

  :global(.tooltip--error .tooltip-content .tooltip-header) {
    color: var(--danger, #ea2b1f);
  }
</style>

