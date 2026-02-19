<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$dashboard/lib/api-client';
  import type { Customer, AuditLog } from '$dashboard/lib/types';
  import Card from '$dashboard/components/Card.svelte';
  import StatusFlair from '@shared-components/svelte/StatusFlair.svelte';

  export let customer: Customer | null = null;

  let logs: AuditLog[] = [];
  let loading = true;
  let error: string | null = null;

  let currentPage = 1;
  let pageSize = 50;
  let totalPages = 1;
  let totalEvents = 0;

  let filters = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    eventType: ''
  };

  const PAGE_SIZE_OPTIONS = [25, 50, 100];

  onMount(async () => {
    await loadPage(1);
  });

  async function loadPage(page: number) {
    loading = true;
    error = null;
    // Discard previous page data immediately
    logs = [];

    try {
      const response = await apiClient.getAuditLogs(customer?.customerId || null, {
        ...filters,
        page,
        pageSize,
      });
      logs = response.events || [];
      totalEvents = response.total ?? logs.length;
      currentPage = response.page ?? page;
      // Compute totalPages from server metadata, or derive it client-side
      // so pagination works even before the backend is redeployed.
      totalPages = response.totalPages ?? Math.max(1, Math.ceil(totalEvents / pageSize));
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      error = err instanceof Error ? err.message : 'Failed to load audit logs';
    } finally {
      loading = false;
    }
  }

  function handleFilterChange() {
    currentPage = 1;
    loadPage(1);
  }

  function handlePageSizeChange(e: Event) {
    pageSize = parseInt((e.target as HTMLSelectElement).value, 10);
    currentPage = 1;
    loadPage(1);
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    loadPage(page);
  }

  /**
   * Build a compact set of page numbers for the pagination bar.
   * Always shows first, last, current, and neighbours -- ellipsis gaps otherwise.
   */
  function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);

    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  }

  $: pageNumbers = getPageNumbers(currentPage, totalPages);
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
    <div class="audit-logs__header">
      <h2 class="audit-logs__section-title">
        Logs
        {#if !loading}
          <span class="audit-logs__count">({totalEvents} total)</span>
        {/if}
      </h2>

      <div class="audit-logs__page-size">
        <label for="page-size-select" class="audit-logs__label">Per page</label>
        <select id="page-size-select" class="audit-logs__select audit-logs__select--compact" onchange={handlePageSizeChange} value={pageSize}>
          {#each PAGE_SIZE_OPTIONS as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if loading}
      <div class="audit-logs__loading">Loading audit logs...</div>
    {:else if error}
      <div class="audit-logs__error">{error}</div>
    {:else if logs.length === 0}
      <div class="audit-logs__empty">
        <div class="icon">★</div>
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

      <!-- Pagination controls -->
      <div class="audit-logs__pagination">
        <span class="audit-logs__pagination-info">
          Page {currentPage} of {totalPages}
        </span>

        <div class="audit-logs__pagination-controls">
          <button
            class="audit-logs__page-btn"
            disabled={currentPage <= 1}
            onclick={() => goToPage(1)}
            aria-label="First page"
          >⟪</button>
          <button
            class="audit-logs__page-btn"
            disabled={currentPage <= 1}
            onclick={() => goToPage(currentPage - 1)}
            aria-label="Previous page"
          >◀</button>

          {#each pageNumbers as pn}
            {#if pn === '...'}
              <span class="audit-logs__page-ellipsis">…</span>
            {:else}
              {@const pageNum = /** @type {number} */ (pn)}
              <button
                class="audit-logs__page-btn"
                class:audit-logs__page-btn--active={pageNum === currentPage}
                onclick={() => goToPage(pageNum)}
              >{pageNum}</button>
            {/if}
          {/each}

          <button
            class="audit-logs__page-btn"
            disabled={currentPage >= totalPages}
            onclick={() => goToPage(currentPage + 1)}
            aria-label="Next page"
          >▶</button>
          <button
            class="audit-logs__page-btn"
            disabled={currentPage >= totalPages}
            onclick={() => goToPage(totalPages)}
            aria-label="Last page"
          >⟫</button>
        </div>
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

  .audit-logs__count {
    font-size: 0.875rem;
    font-weight: 400;
    color: var(--text-secondary);
  }

  .audit-logs__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  .audit-logs__page-size {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
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

  .audit-logs__select--compact {
    width: auto;
    min-width: 70px;
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

  .audit-logs__empty-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  /* Constrained, scrollable table container */
  .audit-logs__table-container {
    max-height: 60vh;
    overflow-y: auto;
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .audit-logs__table {
    width: 100%;
    border-collapse: collapse;
  }

  .audit-logs__table thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--bg-dark);
  }

  .audit-logs__table th {
    text-align: left;
    padding: var(--spacing-md);
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 2px solid var(--border);
  }

  .audit-logs__table td {
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border);
  }

  .audit-logs__timestamp {
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-family: monospace;
    white-space: nowrap;
  }

  .audit-logs__event-type {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    background: var(--bg-dark);
    color: var(--accent);
    white-space: nowrap;
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

  /* Pagination */
  .audit-logs__pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--border);
  }

  .audit-logs__pagination-info {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .audit-logs__pagination-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .audit-logs__page-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 var(--spacing-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .audit-logs__page-btn:hover:not(:disabled) {
    background: var(--border);
  }

  .audit-logs__page-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .audit-logs__page-btn--active {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
    font-weight: 700;
  }

  .audit-logs__page-btn--active:hover {
    background: var(--accent);
  }

  .audit-logs__page-ellipsis {
    padding: 0 var(--spacing-xs);
    color: var(--text-secondary);
    user-select: none;
  }
</style>
