<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { User, Customer } from '$lib/types';
  import Login from './components/Login.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import ApiKeys from './pages/ApiKeys.svelte';
  import AuditLogs from './pages/AuditLogs.svelte';
  import Analytics from './pages/Analytics.svelte';
  import Header from './components/Header.svelte';
  import Navigation from './components/Navigation.svelte';

  let user: User | null = null;
  let customer: Customer | null = null;
  let isAuthenticated = false;
  let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' = 'dashboard';
  let loading = true;

  onMount(async () => {
    // Check authentication
    if (apiClient.getToken()) {
      try {
        user = await apiClient.getMe();
        isAuthenticated = true;
        await loadCustomer();
      } catch (error) {
        console.error('Auth check failed:', error);
        apiClient.setToken(null);
        isAuthenticated = false;
      }
    }
    loading = false;

    // Setup event listeners
    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('auth:logout', handleLogout);
  });

  async function loadCustomer() {
    try {
      customer = await apiClient.getCustomer();
    } catch (error) {
      console.error('Failed to load customer:', error);
    }
  }

  function handleLogin() {
    isAuthenticated = true;
    loadCustomer().then(() => {
      if (user) {
        // User already set from login event
      }
    });
  }

  function handleLogout() {
    isAuthenticated = false;
    user = null;
    customer = null;
    currentPage = 'dashboard';
  }

  function navigateToPage(page: typeof currentPage) {
    currentPage = page;
  }

  function handleLogoutClick() {
    apiClient.logout();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
</script>

<div class="app-container">
  {#if loading}
    <div class="loading">
      <div class="loading__spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if !isAuthenticated}
    <Login />
  {:else}
    <Header {user} on:logout={handleLogoutClick} />
    <main class="app-main">
      <Navigation {currentPage} on:navigate={e => navigateToPage(e.detail)} />
      <div class="page-container">
        {#if currentPage === 'dashboard'}
          <Dashboard {customer} />
        {:else if currentPage === 'api-keys'}
          <ApiKeys {customer} />
        {:else if currentPage === 'audit-logs'}
          <AuditLogs {customer} />
        {:else if currentPage === 'analytics'}
          <Analytics {customer} />
        {/if}
      </div>
    </main>
  {/if}
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-main {
    flex: 1;
    max-width: 1400px;
    width: 100%;
    margin: 0 auto;
    padding: var(--spacing-xl);
  }

  .page-container {
    margin-top: var(--spacing-xl);
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text-secondary);
  }

  .loading .loading__spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .app-main {
      padding: var(--spacing-md);
    }
  }
</style>

