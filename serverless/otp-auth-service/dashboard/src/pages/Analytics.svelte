<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, Analytics, RealtimeAnalytics, ErrorAnalytics, DailyBreakdown } from '$lib/types';
  import Card from '$components/Card.svelte';
  import LineChart from '$components/charts/LineChart.svelte';
  import BarChart from '$components/charts/BarChart.svelte';
  import AreaChart from '$components/charts/AreaChart.svelte';

  // Customer prop - kept for API consistency with other pages (may be used for customer-specific filtering in future)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export let customer: Customer | null = null;

  let analytics: Analytics | null = null;
  let realtime: RealtimeAnalytics | null = null;
  let errors: ErrorAnalytics | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;

    try {
      const [analyticsData, realtimeData, errorsData] = await Promise.all([
        apiClient.getAnalytics().catch(() => null),
        apiClient.getRealtimeAnalytics().catch(() => null),
        apiClient.getErrorAnalytics().catch(() => null)
      ]);

      analytics = analyticsData;
      realtime = realtimeData;
      errors = errorsData;
    } catch (err) {
      console.error('Failed to load analytics:', err);
      error = err instanceof Error ? err.message : 'Failed to load analytics';
    } finally {
      loading = false;
    }
  }

  // Transform daily breakdown for line charts (Observable Plot needs long format for multi-series)
  $: dailyData = analytics?.dailyBreakdown?.flatMap(day => [
    { date: new Date(day.date), variable: 'OTP Requests', value: day.otpRequests },
    { date: new Date(day.date), variable: 'OTP Verifications', value: day.otpVerifications },
    { date: new Date(day.date), variable: 'Successful Logins', value: day.successfulLogins },
    { date: new Date(day.date), variable: 'Failed Attempts', value: day.failedAttempts },
    { date: new Date(day.date), variable: 'Emails Sent', value: day.emailsSent }
  ]) || [];

  // Transform daily breakdown for area chart (success rate)
  $: successRateData = analytics?.dailyBreakdown?.map(day => {
    const total = day.otpRequests || 1;
    const success = day.otpVerifications || 0;
    return {
      date: new Date(day.date),
      'Success Rate': (success / total) * 100
    };
  }) || [];

  // Transform error categories for pie chart
  $: errorCategoryData = errors?.byCategory ? Object.entries(errors.byCategory).map(([label, value]) => ({
    label,
    value
  })) : [];

  // Transform error endpoints for bar chart
  $: errorEndpointData = errors?.byEndpoint ? Object.entries(errors.byEndpoint).map(([category, value]) => ({
    category,
    value
  })) : [];

  // Transform response time metrics for bar chart
  $: responseTimeData = realtime?.responseTimeMetrics ? Object.entries(realtime.responseTimeMetrics).map(([endpoint, metrics]) => ({
    endpoint,
    'Average': metrics.avg,
    'P50': metrics.p50,
    'P95': metrics.p95,
    'P99': metrics.p99
  })) : [];
</script>

<div class="analytics">
  <h1 class="analytics__title">Analytics</h1>

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

    <!-- Daily Breakdown Charts -->
    {#if dailyData.length > 0}
      <Card>
        <h2 class="analytics__section-title">Usage Trends (30 Days)</h2>
        <div class="analytics__chart-container">
          <LineChart
            data={dailyData}
            x="date"
            y="value"
            series="variable"
            title="Daily Activity"
            height={350}
          />
        </div>
      </Card>

      <Card>
        <h2 class="analytics__section-title">Success Rate Trend</h2>
        <div class="analytics__chart-container">
          <AreaChart
            data={successRateData}
            x="date"
            y="Success Rate"
            title="Success Rate Over Time"
            height={300}
          />
        </div>
      </Card>
    {/if}

    <!-- Real-time Analytics -->
    {#if realtime}
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
          {#if realtime.errorRate !== undefined}
            <div class="analytics__realtime-item">
              <div class="analytics__realtime-label">Error Rate</div>
              <div class="analytics__realtime-value">{realtime.errorRate.toFixed(2)}%</div>
            </div>
          {/if}
        </div>

        {#if responseTimeData.length > 0}
          <div class="analytics__chart-container">
            <BarChart
              data={responseTimeData.flatMap(d => [
                { endpoint: d.endpoint, metric: 'Average', value: d.Average },
                { endpoint: d.endpoint, metric: 'P50', value: d.P50 },
                { endpoint: d.endpoint, metric: 'P95', value: d.P95 },
                { endpoint: d.endpoint, metric: 'P99', value: d.P99 }
              ])}
              x="endpoint"
              y="value"
              fill="metric"
              title="Response Time by Endpoint (ms)"
              height={300}
              horizontal={true}
              colors={['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)']}
            />
          </div>
        {/if}
      </Card>
    {/if}

    <!-- Error Analytics -->
    {#if errors && errors.total !== undefined && errors.total > 0}
      <Card>
        <h2 class="analytics__section-title">Error Analytics</h2>
        <div class="analytics__errors">
          <div class="analytics__errors-total">
            <div class="analytics__errors-label">Total Errors</div>
            <div class="analytics__errors-value">{errors.total || 0}</div>
          </div>

          {#if errorCategoryData.length > 0}
            <div class="analytics__errors-charts">
              <div class="analytics__errors-chart">
                <h3 class="analytics__errors-subtitle">Errors by Category</h3>
                <BarChart
                  data={errorCategoryData}
                  x="label"
                  y="value"
                  title=""
                  height={300}
                  colors={['var(--danger)']}
                />
              </div>
              {#if errorEndpointData.length > 0}
                <div class="analytics__errors-chart">
                  <h3 class="analytics__errors-subtitle">Errors by Endpoint</h3>
                  <BarChart
                    data={errorEndpointData}
                    x="category"
                    y="value"
                    title=""
                    height={300}
                    colors={['var(--danger)']}
                  />
                </div>
              {/if}
            </div>
          {/if}

          {#if errors.byCategory && Object.keys(errors.byCategory).length > 0}
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

    {#if !analytics?.today && !realtime?.activeUsers && (!errors?.total || errors.total === 0)}
      <Card>
        <div class="analytics__empty">
          <div class="analytics__empty-icon">[EMOJI]</div>
          <p>No analytics data available yet</p>
          <p class="analytics__empty-hint">Analytics will appear here once you start using the API</p>
        </div>
      </Card>
    {/if}
  {/if}
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

  .analytics__chart-container {
    width: 100%;
    margin-top: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border-radius: var(--radius-md);
  }

  .analytics__realtime {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
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

  .analytics__errors-charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--spacing-lg);
    margin-top: var(--spacing-md);
  }

  .analytics__errors-chart {
    display: flex;
    flex-direction: column;
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
</style>
