<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, Analytics, RealtimeAnalytics, ErrorAnalytics } from '$lib/types';
  import Card from '$components/Card.svelte';
  import StatusFlair from '@strixun/status-flair/StatusFlair.svelte';

  export let customer: Customer | null = null;

  let analytics: Analytics | null = null;
  let realtime: RealtimeAnalytics | null = null;
  let errors: ErrorAnalytics | null = null;
  let emailAnalytics: any = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    // Customer prop available for future customer-specific filtering
    if (customer) {
      // Future: filter analytics by customer
    }
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      const [analyticsData, realtimeData, errorsData, emailData] = await Promise.all([
        apiClient.getAnalytics().catch(() => null),
        apiClient.getRealtimeAnalytics().catch(() => null),
        apiClient.getErrorAnalytics().catch(() => null),
        apiClient.getEmailAnalytics().catch(() => null)
      ]);

      analytics = analyticsData;
      realtime = realtimeData;
      errors = errorsData;
      emailAnalytics = emailData;
    } catch (err) {
      console.error('Failed to load analytics:', err);
      error = err instanceof Error ? err.message : 'Failed to load analytics';
    } finally {
      loading = false;
    }
  }
</script>

<div class="analytics">
  <h1 class="analytics__title">Analytics</h1>

  <StatusFlair status="in-testing">
    <div class="analytics__content">
  {#if loading}
    <div class="analytics__loading">Loading analytics...</div>
  {:else if error}
    <div class="analytics__error">{error}</div>
  {:else}
    {#if analytics?.today}
      <div class="analytics__metrics">
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">OTP Requests (Today)</div>
            <div class="analytics__metric-value analytics__metric-value--accent">
              {analytics.today.otpRequests || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">OTP Verifications (Today)</div>
            <div class="analytics__metric-value analytics__metric-value--success">
              {analytics.today.otpVerifications || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">Successful Logins (Today)</div>
            <div class="analytics__metric-value analytics__metric-value--success">
              {analytics.today.successfulLogins || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">Failed Attempts (Today)</div>
            <div class="analytics__metric-value analytics__metric-value--danger">
              {analytics.today.failedAttempts || 0}
            </div>
          </div>
        </Card>
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">Success Rate</div>
            <div class="analytics__metric-value analytics__metric-value--info">
              {analytics.today.successRate || 0}%
            </div>
          </div>
        </Card>
        <Card>
          <div class="analytics__metric">
            <div class="analytics__metric-label">Emails Sent</div>
            <div class="analytics__metric-value analytics__metric-value--accent2">
              {analytics.today.emailsSent || 0}
            </div>
          </div>
        </Card>
      </div>
    {/if}

    {#if realtime?.activeUsers !== undefined || realtime?.requestsPerMinute !== undefined}
      <Card>
        <h2 class="analytics__section-title">Real-time Metrics</h2>
        <div class="analytics__realtime">
          {#if realtime.activeUsers !== undefined}
            <div class="analytics__realtime-item">
              <div class="analytics__realtime-label">Active Users</div>
              <div class="analytics__realtime-value">{realtime.activeUsers || 0}</div>
            </div>
          {/if}
          {#if realtime.requestsPerMinute !== undefined}
            <div class="analytics__realtime-item">
              <div class="analytics__realtime-label">Requests/Minute</div>
              <div class="analytics__realtime-value">{realtime.requestsPerMinute || 0}</div>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    {#if errors && errors.total !== undefined && errors.total > 0}
      <Card>
        <h2 class="analytics__section-title">Error Analytics</h2>
        <div class="analytics__errors">
          <div class="analytics__errors-total">
            <div class="analytics__errors-label">Total Errors</div>
            <div class="analytics__errors-value">{errors.total || 0}</div>
          </div>
          {#if errors.byCategory}
            <div class="analytics__errors-categories">
              <h3 class="analytics__errors-subtitle">By Category</h3>
              <div class="analytics__errors-grid">
                {#each Object.entries(errors.byCategory) as [category, count]}
                  <div class="analytics__errors-item">
                    <div class="analytics__errors-category">{category}</div>
                    <div class="analytics__errors-count">{count}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    {#if emailAnalytics?.summary}
      <Card>
        <h2 class="analytics__section-title">Email Tracking Analytics</h2>
        <div class="analytics__email">
          <div class="analytics__email-summary">
            <div class="analytics__email-metric">
              <div class="analytics__email-label">Total Opens</div>
              <div class="analytics__email-value">{emailAnalytics.summary.totalOpens || 0}</div>
            </div>
            <div class="analytics__email-metric">
              <div class="analytics__email-label">Unique Countries</div>
              <div class="analytics__email-value">{emailAnalytics.summary.uniqueCountries || 0}</div>
            </div>
            <div class="analytics__email-metric">
              <div class="analytics__email-label">Avg Opens/Day</div>
              <div class="analytics__email-value">{emailAnalytics.summary.averageOpensPerDay || '0'}</div>
            </div>
          </div>
          
          {#if emailAnalytics.countryStats && Object.keys(emailAnalytics.countryStats).length > 0}
            <div class="analytics__email-countries">
              <h3 class="analytics__email-subtitle">Opens by Country</h3>
              <div class="analytics__email-countries-grid">
                {#each Object.entries(emailAnalytics.countryStats).sort(([,a], [,b]) => (b as number) - (a as number)).slice(0, 10) as [country, count]}
                  <div class="analytics__email-country-item">
                    <div class="analytics__email-country-code">{country}</div>
                    <div class="analytics__email-country-count">{count}</div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </Card>
    {/if}

    {#if !analytics?.today && !realtime?.activeUsers && (!errors?.total || errors.total === 0)}
      <Card>
        <div class="analytics__empty">
          <div class="icon">★</div>
          <p>No analytics data available yet</p>
          <p class="analytics__empty-hint">Analytics will appear here once you start using the API</p>
        </div>
      </Card>
    {/if}
  {/if}
    </div>
  </StatusFlair>
</div>

<style>
  .analytics {
    width: 100%;
  }

  .analytics__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .analytics__loading,
  .analytics__error {
    padding: var(--spacing-xl);
    text-align: center;
  }

  .analytics__error {
    color: var(--danger);
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
  }

  .analytics__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .analytics__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .analytics__metric {
    display: flex;
    flex-direction: column;
  }

  .analytics__metric-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .analytics__metric-value {
    font-size: 2rem;
    font-weight: 700;
  }

  .analytics__metric-value--accent {
    color: var(--accent);
  }

  .analytics__metric-value--success {
    color: var(--success);
  }

  .analytics__metric-value--danger {
    color: var(--danger);
  }

  .analytics__metric-value--info {
    color: var(--info);
  }

  .analytics__metric-value--accent2 {
    color: var(--accent2);
  }

  .analytics__realtime {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .analytics__realtime-item {
    display: flex;
    flex-direction: column;
  }

  .analytics__realtime-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .analytics__realtime-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent);
  }

  .analytics__errors {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .analytics__errors-total {
    display: flex;
    flex-direction: column;
  }

  .analytics__errors-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .analytics__errors-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--danger);
  }

  .analytics__errors-subtitle {
    font-size: 1rem;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
  }

  .analytics__errors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--spacing-md);
  }

  .analytics__errors-item {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm);
  }

  .analytics__errors-category {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .analytics__errors-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--danger);
  }

  .analytics__empty {
    text-align: center;
    padding: var(--spacing-3xl);
    color: var(--text-secondary);
  }

  .analytics__empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .analytics__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .analytics__content {
    width: 100%;
  }

  .analytics__email {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .analytics__email-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .analytics__email-metric {
    display: flex;
    flex-direction: column;
  }

  .analytics__email-label {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-xs);
  }

  .analytics__email-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent);
  }

  .analytics__email-subtitle {
    font-size: 1rem;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
  }

  .analytics__email-countries {
    margin-top: var(--spacing-md);
  }

  .analytics__email-countries-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--spacing-md);
  }

  .analytics__email-country-item {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .analytics__email-country-code {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: var(--spacing-xs);
  }

  .analytics__email-country-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--accent);
  }
</style>

