<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';

  export let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' = 'dashboard';

  const dispatch = createEventDispatcher();

  const pages = [
    { id: 'dashboard', label: 'Dashboard', status: null as 'wip' | 'in-testing' | null },
    { id: 'api-keys', label: 'API Keys', status: null as 'wip' | 'in-testing' | null },
    { id: 'audit-logs', label: 'Audit Logs', status: 'in-testing' as 'wip' | 'in-testing' | null },
    { id: 'analytics', label: 'Analytics', status: 'in-testing' as 'wip' | 'in-testing' | null }
  ] as const;

  function handleClick(page: typeof currentPage) {
    dispatch('navigate', page);
  }
</script>

<nav class="app-nav">
  <ul class="app-nav__list">
    {#each pages as page}
      <li class="app-nav__item">
        <StatusFlair status={page.status}>
          <button
            class="app-nav__link"
            class:active={currentPage === page.id}
            onclick={() => handleClick(page.id)}
          >
            {page.label}
          </button>
        </StatusFlair>
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

  @media (max-width: 768px) {
    .app-nav {
      padding: var(--spacing-sm);
    }

    .app-nav__list {
      gap: var(--spacing-xs);
    }

    .app-nav__link {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: 0.8rem;
    }
  }

  @media (max-width: 480px) {
    .app-nav {
      padding: var(--spacing-xs);
    }

    .app-nav__list {
      gap: 4px;
    }

    .app-nav__link {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 0.7rem;
      letter-spacing: 0px;
      white-space: nowrap;
    }
  }
</style>

