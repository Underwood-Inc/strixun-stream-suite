<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { Customer, AuditLog } from '$lib/types';
  import Card from '$components/Card.svelte';
  import StatusFlair from '@strixun/status-flair/StatusFlair.svelte';

  export let customer: Customer | null = null;

  let logs: AuditLog[] = [];
  let loading = true;
  let error: string | null = null;
  let filters = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    eventType: ''
  };

  onMount(async () => {
    await loadLogs();
  });

  async function loadLogs() {
    loading = true;
    error = null;

    try {
      const response = await apiClient.getAuditLogs(customer?.customerId || null, filters);
      logs = response.events || [];
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      error = err instanceof Error ? err.message : 'Failed to load audit logs';
    } finally {
      loading = false;
    }
  }

  function handleFilterChange() {
    loadLogs();
  }
</script>

<div class="audit-logs">
  <h1 class="audit-logs__title">Audit Logs</h1>

  <StatusFlair status="in-testing">
    <Card>
    <h2 class="audit-logs__section-title">Filters</h2>
    <div class="audit-logs__filters">
      <div class="audit-logs__filter">
        <label for="filter-start-date" class="audit-logs__label">Start Date</label>
        <input
          type="date"
          id="filter-start-date"
          class="audit-logs__input"
          bind:value={filters.startDate}
        />
      </div>
      <div class="audit-logs__filter">
        <label for="filter-end-date" class="audit-logs__label">End Date</label>
        <input
          type="date"
          id="filter-end-date"
          class="audit-logs__input"
          bind:value={filters.endDate}
        />
      </div>
      <div class="audit-logs__filter">
        <label for="filter-event-type" class="audit-logs__label">Event Type</label>
        <select id="filter-event-type" class="audit-logs__select" bind:value={filters.eventType}>
          <option value="">All Events</option>
          <option value="otp_requested">OTP Requested</option>
          <option value="otp_verified">OTP Verified</option>
          <option value="otp_failed">OTP Failed</option>
          <option value="login_success">Login Success</option>
          <option value="login_failed">Login Failed</option>
          <option value="api_key_created">API Key Created</option>
          <option value="api_key_revoked">API Key Revoked</option>
          <option value="user_data_deleted">User Data Deleted</option>
        </select>
      </div>
      <div class="audit-logs__filter audit-logs__filter--button">
        <button class="audit-logs__button" onclick={handleFilterChange}>Apply Filters</button>
      </div>
    </div>
  </Card>

  <Card>
    <h2 class="audit-logs__section-title">Logs ({logs.length})</h2>
    {#if loading}
      <div class="audit-logs__loading">Loading audit logs...</div>
    {:else if error}
      <div class="audit-logs__error">{error}</div>
    {:else if logs.length === 0}
      <div class="audit-logs__empty">
        <div class="audit-logs__empty-icon">📝</div>
        <p>No audit logs found</p>
        <p class="audit-logs__empty-hint">Try adjusting your filters or check back later</p>
      </div>
    {:else}
      <div class="audit-logs__table-container">
        <table class="audit-logs__table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Type</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log}
              <tr>
                <td class="audit-logs__timestamp">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td>
                  <span class="audit-logs__event-type">{log.eventType || 'unknown'}</span>
                </td>
                <td class="audit-logs__details">
                  <pre class="audit-logs__details-pre">{JSON.stringify(log, null, 2).replace(/{|}|"/g, '').slice(0, 200)}{JSON.stringify(log).length > 200 ? '...' : ''}</pre>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    </Card>
  </StatusFlair>
</div>

<style>
  .audit-logs {
    width: 100%;
  }

  .audit-logs__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-xl);
    color: var(--accent);
  }

  .audit-logs__section-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .audit-logs__filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-md);
  }

  .audit-logs__filter {
    display: flex;
    flex-direction: column;
  }

  .audit-logs__filter--button {
    display: flex;
    align-items: flex-end;
  }

  .audit-logs__label {
    display: block;
    margin-bottom: var(--spacing-xs);
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .audit-logs__input,
  .audit-logs__select {
    width: 100%;
    padding: var(--spacing-sm);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
  }

  .audit-logs__button {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--accent);
    border: 3px solid var(--accent-dark);
    border-radius: 0;
    color: #000;
    font-weight: 700;
    cursor: pointer;
  }

  .audit-logs__loading,
  .audit-logs__error {
    padding: var(--spacing-xl);
    text-align: center;
  }

  .audit-logs__error {
    color: var(--danger);
  }

  .audit-logs__empty {
    text-align: center;
    padding: var(--spacing-3xl);
    color: var(--text-secondary);
  }

  .audit-logs__empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .audit-logs__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .audit-logs__table-container {
    overflow-x: auto;
  }

  .audit-logs__table {
    width: 100%;
    border-collapse: collapse;
  }

  .audit-logs__table th {
    text-align: left;
    padding: var(--spacing-md);
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .audit-logs__table td {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .audit-logs__timestamp {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-family: monospace;
  }

  .audit-logs__event-type {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    background: var(--bg-dark);
    color: var(--accent);
  }

  .audit-logs__details {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .audit-logs__details-pre {
    margin: 0;
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>

