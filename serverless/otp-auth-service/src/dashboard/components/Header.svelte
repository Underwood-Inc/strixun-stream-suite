<script lang="ts">
  import type { User } from '../lib/types';
  import { createEventDispatcher } from 'svelte';

  export let user: User | null = null;

  const dispatch = createEventDispatcher();

  function handleLogout() {
    dispatch('logout');
  }
</script>

<header class="app-header">
  <div class="app-header__content">
    <a href="/" class="app-header__logo"> ★ OTP Auth API</a>
    {#if user}
      <div class="app-header__user">
        <span class="app-header__email">{user.email || 'User'}</span>
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

  .app-header__email {
    color: var(--text-secondary);
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
    .app-header__content {
      flex-direction: column;
      gap: var(--spacing-md);
    }
  }
</style>

