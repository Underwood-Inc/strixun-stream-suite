<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, Analytics } from '$lib/types';
  import Card from '$components/Card.svelte';

  export let customer: Customer | null = null;

  let analytics: Analytics | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    // Set timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Dashboard data load timed out');
        loading = false;
        error = 'Failed to load dashboard data: Request timed out';
      }
    }, 5000);

    try {
      await loadData();
    } finally {
      clearTimeout(timeout);
    }
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      if (!customer) {
        customer = await apiClient.getCustomer();
      }
      analytics = await apiClient.getAnalytics();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      loading = false;
    }
  }
</script>

<div class="dashboard">
  <h1 class="dashboard__title">Dashboard</h1>

  {#if loading}
    <div class="dashboard__loading">Loading...</div>
  {:else if error}
    <div class="dashboard__error">{error}</div>
  {:else}
    {#if customer}
      <Card>
        <h2 class="dashboard__section-title">Account Information</h2>
        <div class="dashboard__info-grid">
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Customer ID</div>
            <div class="dashboard__info-value">{customer.customerId || 'N/A'}</div>
          </div>
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Status</div>
            <div class="dashboard__info-value" class:status-active={customer.status === 'active'} class:status-warning={customer.status !== 'active'}>
              {customer.status || 'unknown'}
            </div>
          </div>
          <div class="dashboard__info-item">
            <div class="dashboard__info-label">Plan</div>
            <div class="dashboard__info-value">{customer.plan || 'free'}</div>
          </div>
        </div>
      </Card>
    {/if}

    {#if analytics?.today}
      <div class="dashboard__metrics">
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">OTP Requests (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--accent">
              {analytics.today.otpRequests || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Successful Logins (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--success">
              {analytics.today.successfulLogins || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Failed Attempts (Today)</div>
            <div class="dashboard__metric-value dashboard__metric-value--danger">
              {analytics.today.failedAttempts || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="dashboard__metric">
            <div class="dashboard__metric-label">Success Rate</div>
            <div class="dashboard__metric-value dashboard__metric-value--info">
              {analytics.today.successRate || 0}%
            </div>
          </div>
        </Card>
      </div>
    {:else}
      <Card>
        <div class="dashboard__empty">
          <div class="dashboard__empty-icon">📊</div>
          <p>No analytics data available yet</p>
          <p class="dashboard__empty-hint">Analytics will appear here once you start using the API</p>
        </div>
      </Card>
    {/if}
  {/if}
</div>

<style>
  .dashboard {
    width: 100%;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .dashboard__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .dashboard__loading,
  .dashboard__error {
    padding: var(--spacing-xl);
    text-align: center;
    color: var(--text-secondary);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .dashboard__error {
    color: var(--danger);
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .dashboard__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .dashboard__info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .dashboard__info-item {
    display: flex;
    flex-direction: column;
  }

  .dashboard__info-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .dashboard__info-value {
    font-weight: 600;
    font-family: monospace;
  }

  .dashboard__info-value.status-active {
    color: var(--success);
  }

  .dashboard__info-value.status-warning {
    color: var(--warning);
  }

  .dashboard__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-xl);
  }

  .dashboard__metric {
    display: flex;
    flex-direction: column;
  }

  .dashboard__metric-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .dashboard__metric-value {
    font-size: 2rem;
    font-weight: 700;
  }

  .dashboard__metric-value--accent {
    color: var(--accent);
  }

  .dashboard__metric-value--success {
    color: var(--success);
  }

  .dashboard__metric-value--danger {
    color: var(--danger);
  }

  .dashboard__metric-value--info {
    color: var(--info);
  }

  .dashboard__empty {
    text-align: center;
    padding: var(--spacing-3xl);
    color: var(--text-secondary);
  }

  .dashboard__empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .dashboard__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>

