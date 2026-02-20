<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$dashboard/lib/api-client';
  import type { UsageSummaryResponse } from '$dashboard/lib/types';
  import Card from '$dashboard/components/Card.svelte';

  let loading = true;
  let error: string | null = null;
  let data: UsageSummaryResponse | null = null;

  onMount(async () => {
    await loadUsage();
  });

  async function loadUsage() {
    loading = true;
    error = null;
    try {
      data = await apiClient.getApiKeyUsageSummary();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load usage data';
    } finally {
      loading = false;
    }
  }

  function barColor(pct: number): string {
    if (pct >= 90) return 'var(--danger)';
    if (pct >= 80) return 'var(--warning)';
    return 'var(--success)';
  }
</script>

<Card>
  <h2 class="usage__title">API Key Usage &amp; Quota</h2>

  {#if loading}
    <p class="usage__loading">Loading usage data...</p>
  {:else if error}
    <p class="usage__error">{error}</p>
  {:else if data}
    <div class="usage__plan-row">
      <span class="usage__plan-badge">{data.plan.toUpperCase()}</span>
      <span class="usage__plan-limits">
        {data.quota.dailyLimit.toLocaleString()}/day &bull;
        {data.quota.monthlyLimit.toLocaleString()}/month
      </span>
    </div>

    {#if data.suggestUpgrade}
      <div class="usage__upgrade">
        You're approaching your plan limits. Consider upgrading for more capacity.
      </div>
    {/if}

    <div class="usage__bars">
      <div class="usage__bar-group">
        <div class="usage__bar-label">
          <span>Today</span>
          <span class="usage__bar-pct">{data.dailyUsagePercent}%</span>
        </div>
        <div class="usage__bar-track">
          <div class="usage__bar-fill" style="width: {Math.min(data.dailyUsagePercent, 100)}%; background: {barColor(data.dailyUsagePercent)}"></div>
        </div>
        <span class="usage__bar-count">
          {data.customerTotal.todayRequests.toLocaleString()} / {data.quota.dailyLimit.toLocaleString()}
        </span>
      </div>

      <div class="usage__bar-group">
        <div class="usage__bar-label">
          <span>This Month</span>
          <span class="usage__bar-pct">{data.monthlyUsagePercent}%</span>
        </div>
        <div class="usage__bar-track">
          <div class="usage__bar-fill" style="width: {Math.min(data.monthlyUsagePercent, 100)}%; background: {barColor(data.monthlyUsagePercent)}"></div>
        </div>
        <span class="usage__bar-count">
          {data.customerTotal.monthRequests.toLocaleString()} / {data.quota.monthlyLimit.toLocaleString()}
        </span>
      </div>
    </div>

    {#if data.keys.length > 0}
      <h3 class="usage__subtitle">Per-Key Breakdown</h3>
      <div class="usage__keys">
        {#each data.keys as key}
          <div class="usage__key-row">
            <div class="usage__key-header">
              <span class="usage__key-name">{key.name}</span>
              <code class="usage__key-id">{key.keyId.substring(0, 8)}...</code>
            </div>
            <div class="usage__key-stats">
              <div class="usage__stat">
                <span class="usage__stat-label">Today</span>
                <span class="usage__stat-value">{key.today.requests}</span>
              </div>
              <div class="usage__stat">
                <span class="usage__stat-label">Month</span>
                <span class="usage__stat-value">{key.month.requests}</span>
              </div>
              <div class="usage__stat">
                <span class="usage__stat-label">OTP Req</span>
                <span class="usage__stat-value">{key.today.otpRequests}</span>
              </div>
              <div class="usage__stat">
                <span class="usage__stat-label">Verified</span>
                <span class="usage__stat-value usage__stat-value--success">{key.today.otpVerifications}</span>
              </div>
              <div class="usage__stat">
                <span class="usage__stat-label">Failed</span>
                <span class="usage__stat-value usage__stat-value--danger">{key.today.otpFailures}</span>
              </div>
              {#if key.today.lastRequest}
                <div class="usage__stat usage__stat--wide">
                  <span class="usage__stat-label">Last Active</span>
                  <span class="usage__stat-value usage__stat-value--muted">
                    {new Date(key.today.lastRequest).toLocaleTimeString()}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</Card>

<style>
  .usage__title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .usage__loading, .usage__error {
    padding: var(--spacing-md);
    text-align: center;
  }
  .usage__error { color: var(--danger); }

  .usage__plan-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .usage__plan-badge {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--accent);
    color: #000;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .usage__plan-limits {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .usage__upgrade {
    padding: var(--spacing-md);
    background: rgba(255,165,0,0.12);
    border: 1px solid var(--warning);
    border-radius: var(--radius-md);
    color: var(--warning);
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: var(--spacing-lg);
  }

  .usage__bars {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .usage__bar-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .usage__bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .usage__bar-pct { font-weight: 600; color: var(--text); }

  .usage__bar-track {
    height: 10px;
    background: var(--bg-dark);
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .usage__bar-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 0.4s ease;
  }

  .usage__bar-count {
    font-size: 0.75rem;
    color: var(--muted);
    text-align: right;
  }

  .usage__subtitle {
    font-size: 1rem;
    color: var(--accent);
    margin-bottom: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }

  .usage__keys {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .usage__key-row {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .usage__key-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
  }

  .usage__key-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .usage__key-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg);
    padding: 2px var(--spacing-xs);
    border-radius: var(--radius-sm);
  }

  .usage__key-stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  .usage__stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 60px;
  }

  .usage__stat--wide { min-width: 100px; }

  .usage__stat-label {
    font-size: 0.625rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .usage__stat-value { font-size: 1rem; font-weight: 600; }
  .usage__stat-value--success { color: var(--success); }
  .usage__stat-value--danger { color: var(--danger); }
  .usage__stat-value--muted { color: var(--text-secondary); font-size: 0.75rem; }
</style>
