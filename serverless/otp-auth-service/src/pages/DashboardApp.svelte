<script lang="ts">
  import { apiClient } from '$lib/api-client';
  import type { Customer, User } from '$lib/types';
  import { onMount, tick } from 'svelte';
  import DashboardHeader from '$components/Header.svelte';
  import Login from '../dashboard/components/Login.svelte';
  import Signup from '../dashboard/components/Signup.svelte';
  import Navigation from '$components/Navigation.svelte';
  import Analytics from '../dashboard/pages/Analytics.svelte';
  import ApiKeys from '../dashboard/pages/ApiKeys.svelte';
  import AuditLogs from '../dashboard/pages/AuditLogs.svelte';
  import Dashboard from '../dashboard/pages/Dashboard.svelte';
  import TwitchAdCarousel from '@shared-components/ad-carousel/TwitchAdCarousel.svelte';

  let user: User | null = null;
  let customer: Customer | null = null;
  let isAuthenticated = false;
  let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' = 'dashboard';
  let loading = true;
  let authView: 'login' | 'signup' = 'login';

  onMount(async () => {
    // Setup event listeners first
    window.addEventListener('auth:login', handleLogin as EventListener);
    window.addEventListener('auth:logout', handleLogout as EventListener);
    window.addEventListener('auth:show-login', () => { authView = 'login'; });
    window.addEventListener('auth:show-signup', () => { authView = 'signup'; });
    window.addEventListener('auth:no-customer-account', handleNoCustomerAccount as EventListener);
    
    // Check authentication with timeout
    const authCheck = async () => {
      try {
        if (apiClient.getToken()) {
          user = await apiClient.getMe();
          isAuthenticated = true;
          await loadCustomer();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        apiClient.setToken(null);
        isAuthenticated = false;
      } finally {
        loading = false;
      }
    };
    
    // Set a timeout to ensure loading doesn't hang forever
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth check timed out, showing login');
        loading = false;
        isAuthenticated = false;
      }
    }, 3000);
    
    authCheck().finally(() => {
      clearTimeout(timeout);
    });
  });

  async function loadCustomer() {
    try {
      customer = await apiClient.getCustomer();
    } catch (error: any) {
      console.error('Failed to load customer:', error);
      
      // Check if error is "no customer account"
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code || '';
      
      if (errorCode === 'AUTHENTICATION_REQUIRED' || 
          errorMessage.includes('No customer account') || 
          errorMessage.includes('customer account found')) {
        // No customer account - show signup prompt
        window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
          detail: { 
            email: user?.email,
            message: 'You need to create a customer account to access the dashboard.'
          }
        }));
        // Log them out so they can sign up
        isAuthenticated = false;
        user = null;
        apiClient.setToken(null);
      }
    }
  }

  function handleNoCustomerAccount(event: Event) {
    const customEvent = event as CustomEvent;
    const email = customEvent.detail?.email;
    
    // Automatically switch to signup view
    authView = 'signup';
    
    // Pre-fill email if available
    if (email) {
      // Store email for signup component to use
      sessionStorage.setItem('signup-email', email);
    }
    
    // Clear any auth state
    isAuthenticated = false;
    user = null;
    apiClient.setToken(null);
  }

  async function handleLogin(event: Event) {
    const customEvent = event as CustomEvent;
    const eventUser = customEvent.detail?.user;
    if (eventUser) {
      // Map the event user data to User type
      user = {
        sub: eventUser.userId || eventUser.sub || '',
        email: eventUser.email || '',
        email_verified: true
      };
    }
    // Update state synchronously to trigger reactive update
    isAuthenticated = true;
    loading = false;
    
    // Force a tick to ensure DOM updates
    await tick();
    
    // Load customer data in background
    loadCustomer();
  }

  function handleLogout(_event: Event) {
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
    {#if authView === 'login'}
      <Login />
    {:else}
      <Signup />
    {/if}
  {:else}
    <DashboardHeader {user} on:logout={handleLogoutClick} />
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

{#if isAuthenticated}
  <TwitchAdCarousel
    position="bottom-right"
    supportUrl="https://www.twitch.tv/strixun"
    storageKey="ui_otp_auth_ad_carousel_state"
  />
{/if}

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
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .page-container {
    margin-top: var(--spacing-xl);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text-secondary);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg);
    z-index: 9999;
    pointer-events: auto;
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

