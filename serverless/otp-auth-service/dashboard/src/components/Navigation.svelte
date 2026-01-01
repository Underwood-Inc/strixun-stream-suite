<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Tooltip from '@strixun/tooltip/Tooltip.svelte';

  export let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' = 'dashboard';

  const dispatch = createEventDispatcher();

  const pages = [
    { 
      id: 'dashboard', 
      label: 'Dashboard',
      tooltip: 'Overview of your API usage and account information',
      level: 'log' as const
    },
    { 
      id: 'api-keys', 
      label: 'API Keys',
      tooltip: 'Manage your API keys for authenticating requests',
      level: 'log' as const
    },
    { 
      id: 'audit-logs', 
      label: 'Audit Logs',
      tooltip: 'View detailed logs of all API requests and authentication events',
      level: 'info' as const
    },
    { 
      id: 'analytics', 
      label: 'Analytics',
      tooltip: 'Track usage statistics, performance metrics, and trends',
      level: 'info' as const
    }
  ] as const;

  function handleClick(page: typeof currentPage) {
    dispatch('navigate', page);
  }
</script>

<nav class="app-nav">
  <ul class="app-nav__list">
    {#each pages as page}
      <li class="app-nav__item">
        <Tooltip 
          text={page.tooltip} 
          position="bottom" 
          delay={0}
          level={page.level}
        >
          <button
            class="app-nav__link"
            class:active={currentPage === page.id}
            onclick={() => handleClick(page.id)}
          >
            {page.label}
          </button>
        </Tooltip>
      </li>
    {/each}
  </ul>
</nav>

<style>
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

  .app-nav__link:hover {
    color: var(--text);
    background: var(--bg-dark);
  }

  .app-nav__link.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--bg-dark);
  }
</style>

