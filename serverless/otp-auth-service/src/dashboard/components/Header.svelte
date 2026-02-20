<script lang="ts">
  import type { Customer } from '$dashboard/lib/types';
  import { createEventDispatcher } from 'svelte';

  export let customer: Customer | null = null;

  const dispatch = createEventDispatcher();

  function handleLogout() {
    dispatch('logout');
  }
</script>

<header class="app-header">
  <div class="app-header__content">
    <a href="/" class="app-header__logo"> ★ OTP Auth API</a>
    {#if customer}
      <div class="app-header__user">
        <span class="app-header__user-label">
          Logged in as <span class="app-header__display-name">{customer.displayName || 'Customer'}</span>
        </span>
        <button class="app-header__logout" onclick={handleLogout}>Logout</button>
      </div>
    {/if}
  </div>
</header>

<style>
  .app-header {
    background: var(--card);
    border-bottom: 1px solid var(--border);
    padding: var(--spacing-md) var(--spacing-xl);
    position: sticky;
    top: 0;
    z-index: 100;
    backdrop-filter: blur(10px);
    background: rgba(37, 32, 23, 0.95);
  }

  .app-header__content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .app-header__logo {
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-decoration: none;
  }

  .app-header__user {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .app-header__user-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;
  }

  .app-header__display-name {
    color: var(--text);
    font-weight: 600;
  }

  .app-header__logout {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: transparent;
    border: 2px solid var(--border);
    border-radius: 0;
    color: var(--text);
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .app-header__logout:hover {
    background: var(--bg-dark);
    border-color: var(--border-light);
  }

  @media (max-width: 768px) {
    .app-header {
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .app-header__content {
      flex-direction: row;
      gap: var(--spacing-sm);
    }

    .app-header__logo {
      font-size: 1.1rem;
    }

    .app-header__user {
      gap: var(--spacing-sm);
    }

    .app-header__user-label {
      max-width: 150px;
      font-size: 0.875rem;
    }

    .app-header__logout {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .app-header {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .app-header__content {
      gap: var(--spacing-xs);
    }

    .app-header__logo {
      font-size: 1rem;
    }

    .app-header__user-label {
      max-width: 120px;
      font-size: 0.75rem;
    }

    .app-header__logout {
      padding: 4px var(--spacing-xs);
      font-size: 0.65rem;
      letter-spacing: 0px;
    }
  }
</style>

