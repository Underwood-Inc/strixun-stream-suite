<script lang="ts">
  import { apiClient } from '$dashboard/lib/api-client';
  import type { Customer } from '$dashboard/lib/types';
  import { onMount, tick } from 'svelte';
  import DashboardHeader from '$dashboard/components/Header.svelte';
  import Login from '$dashboard/components/Login.svelte';
  import Signup from '$dashboard/components/Signup.svelte';
  import Navigation from '$dashboard/components/Navigation.svelte';
  import Analytics from '$dashboard/pages/Analytics.svelte';
  import ApiKeys from '$dashboard/pages/ApiKeys.svelte';
  import AuditLogs from '$dashboard/pages/AuditLogs.svelte';
  import Dashboard from '$dashboard/pages/Dashboard.svelte';
  import RolesPermissions from '$dashboard/pages/RolesPermissions.svelte';
  import TwitchAdCarousel from '@strixun/ad-carousel/TwitchAdCarousel.svelte';

  let customer: Customer | null = null;
  let isAuthenticated = false;
  let rolesVerified = false;
  let currentPage: 'dashboard' | 'api-keys' | 'audit-logs' | 'analytics' | 'roles-permissions' = 'dashboard';
  let loading = true;
  let authView: 'login' | 'signup' = 'login';
  let userRoles: string[] = [];

  onMount(async () => {
    // Setup event listeners first
    window.addEventListener('auth:login', handleLogin as EventListener);
    window.addEventListener('auth:logout', handleLogout as EventListener);
    window.addEventListener('auth:show-login', () => { authView = 'login'; });
    window.addEventListener('auth:show-signup', () => { authView = 'signup'; });
    window.addEventListener('auth:no-customer-account', handleNoCustomerAccount as EventListener);
    
    // Check authentication with timeout
    // CRITICAL: HttpOnly cookie SSO means we cannot read a token client-side.
    // Step 1: Hit /auth/me (same fast endpoint all other SSO apps use) to verify cookie.
    // Step 2: If authenticated, load customer data from /customer/me separately.
    const authCheck = async () => {
      try {
        // Step 1: Fast SSO check via /auth/me (proxied to otp-auth-service)
        const authResult = await apiClient.checkAuth();
        if (!authResult) {
          isAuthenticated = false;
          return;
        }
        
        // Step 2: SSO confirmed - set customer with displayName from /auth/me so header shows who's logged in
        isAuthenticated = true;
        customer = {
          customerId: authResult.customerId,
          displayName: authResult.displayName ?? 'Customer',
          email: '',
          status: 'active',
          plan: 'free',
          createdAt: new Date().toISOString(),
        };
        try {
          await loadCustomer();
        } catch (customerError) {
          rolesVerified = false;
          console.warn('Customer data load failed (SSO still valid):', customerError);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        apiClient.setToken(null);
        isAuthenticated = false;
        customer = null;
        userRoles = [];
        rolesVerified = false;
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
    }, 5000);
    
    authCheck().finally(() => {
      clearTimeout(timeout);
    });
  });

  async function loadCustomer() {
    try {
      const fullCustomer = await apiClient.getCustomer();
      customer = fullCustomer;
      if (!fullCustomer?.customerId) {
        rolesVerified = false;
        return;
      }
      userRoles = await apiClient.getUserRoles(fullCustomer.customerId);
      rolesVerified = true;
    } catch (error: any) {
      console.error('Failed to load customer:', error);
      userRoles = [];
      rolesVerified = false;

      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code || '';

      if (errorCode === 'AUTHENTICATION_REQUIRED' ||
          errorMessage.includes('No customer account') ||
          errorMessage.includes('customer account found')) {
        window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
          detail: {
            email: customer?.email,
            message: 'You need to create a customer account to access the dashboard.'
          }
        }));
        isAuthenticated = false;
        customer = null;
        userRoles = [];
        rolesVerified = false;
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
    customer = null;
    apiClient.setToken(null);
  }

  async function handleLogin(_event: Event) {
    isAuthenticated = true;
    loading = false;
    rolesVerified = false;

    const authResult = await apiClient.checkAuth();
    if (authResult) {
      customer = {
        customerId: authResult.customerId,
        displayName: authResult.displayName ?? 'Customer',
        email: '',
        status: 'active',
        plan: 'free',
        createdAt: new Date().toISOString(),
      };
    }

    await tick();
    loadCustomer();
  }

  function handleLogout(_event: Event) {
    isAuthenticated = false;
    customer = null;
    userRoles = [];
    rolesVerified = false;
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
    <DashboardHeader {customer} on:logout={handleLogoutClick} />
    <main class="app-main">
      {#if rolesVerified}
        <Navigation {currentPage} {userRoles} on:navigate={e => navigateToPage(e.detail)} />
        <div class="page-container">
          {#if currentPage === 'dashboard'}
            <Dashboard {customer} />
          {:else if currentPage === 'api-keys'}
            <ApiKeys {customer} />
          {:else if currentPage === 'audit-logs'}
            <AuditLogs {customer} />
          {:else if currentPage === 'analytics'}
            <Analytics {customer} />
          {:else if currentPage === 'roles-permissions'}
            <RolesPermissions {customer} {userRoles} />
          {/if}
        </div>
      {:else}
        <div class="access-denied">
          <h2>Access verification failed</h2>
          <p>Unable to verify your permissions. You cannot access the dashboard until your roles are confirmed.</p>
          <div class="access-denied__actions">
            <button class="access-denied__retry" onclick={() => loadCustomer()}>Retry</button>
            <button class="access-denied__logout" onclick={handleLogoutClick}>Logout</button>
          </div>
        </div>
      {/if}
    </main>
  {/if}
</div>

{#if isAuthenticated}
  <TwitchAdCarousel
    position="bottom-right"
    supportUrl="https://sponsor.idling.app"
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

  .access-denied {
    margin-top: var(--spacing-xl);
    padding: var(--spacing-xl);
    background: var(--card);
    border: 1px solid var(--border);
    text-align: center;
  }

  .access-denied h2 {
    color: var(--text);
    margin-bottom: var(--spacing-md);
  }

  .access-denied p {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-lg);
  }

  .access-denied__actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
  }

  .access-denied__retry,
  .access-denied__logout {
    padding: var(--spacing-sm) var(--spacing-lg);
    font-weight: 600;
    cursor: pointer;
    border: 2px solid var(--border);
    background: transparent;
    color: var(--text);
  }

  .access-denied__retry:hover,
  .access-denied__logout:hover {
    border-color: var(--border-light);
  }

  .access-denied__logout {
    border-color: var(--error, #c53030);
    color: var(--error, #c53030);
  }

  @media (max-width: 768px) {
    .app-main {
      padding: var(--spacing-md);
    }

    .page-container {
      margin-top: var(--spacing-md);
    }
  }

  @media (max-width: 480px) {
    .app-main {
      padding: var(--spacing-sm);
    }

    .page-container {
      margin-top: var(--spacing-sm);
    }
  }
</style>

