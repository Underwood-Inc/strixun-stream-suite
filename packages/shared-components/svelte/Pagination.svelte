<script lang="ts">
/**
 * Pagination Component - Shared Svelte Implementation
 *
 * Composable, server-side-pagination-aware page navigation.
 * Renders first/prev/numbered/next/last controls with ellipsis
 * compression and an optional per-page size selector.
 *
 * Props:
 *   currentPage  – 1-based active page
 *   totalPages   – total number of pages
 *   totalItems   – total item count (for display only)
 *   pageSize     – current items-per-page
 *   pageSizeOptions – array of selectable sizes (e.g. [25, 50, 100])
 *   onPageChange(page)     – called when navigation buttons are clicked
 *   onPageSizeChange(size) – called when the size selector changes
 */

import { createEventDispatcher } from 'svelte';

export let currentPage = 1;
export let totalPages = 1;
export let totalItems = 0;
export let pageSize = 50;
export let pageSizeOptions: number[] = [25, 50, 100];
export let showPageSizeSelector = true;

const dispatch = createEventDispatcher<{
  pageChange: number;
  pageSizeChange: number;
}>();

function goToPage(page: number) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  dispatch('pageChange', page);
}

function handleSizeChange(e: Event) {
  const newSize = parseInt((e.target as HTMLSelectElement).value, 10);
  dispatch('pageSizeChange', newSize);
}

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

<div class="pagination">
  <div class="pagination__info">
    <span class="pagination__summary">
      Page {currentPage} of {totalPages}
      {#if totalItems > 0}
        <span class="pagination__total">({totalItems.toLocaleString()} items)</span>
      {/if}
    </span>

    {#if showPageSizeSelector}
      <label class="pagination__size-label">
        Per page
        <select class="pagination__size-select" onchange={handleSizeChange} value={pageSize}>
          {#each pageSizeOptions as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>

  <div class="pagination__controls">
    <button class="pagination__btn" disabled={currentPage <= 1} onclick={() => goToPage(1)} aria-label="First page">⟪</button>
    <button class="pagination__btn" disabled={currentPage <= 1} onclick={() => goToPage(currentPage - 1)} aria-label="Previous page">◀</button>

    {#each pageNumbers as pn}
      {#if pn === '...'}
        <span class="pagination__ellipsis">…</span>
      {:else}
        {@const pageNum = /** @type {number} */ (pn)}
        <button
          class="pagination__btn"
          class:pagination__btn--active={pageNum === currentPage}
          onclick={() => goToPage(pageNum)}
        >{pageNum}</button>
      {/if}
    {/each}

    <button class="pagination__btn" disabled={currentPage >= totalPages} onclick={() => goToPage(currentPage + 1)} aria-label="Next page">▶</button>
    <button class="pagination__btn" disabled={currentPage >= totalPages} onclick={() => goToPage(totalPages)} aria-label="Last page">⟫</button>
  </div>
</div>

<style>
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md, 1rem);
    margin-top: var(--spacing-lg, 1.5rem);
    padding-top: var(--spacing-md, 1rem);
    border-top: 1px solid var(--border, #333);
  }

  .pagination__info {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg, 1.5rem);
  }

  .pagination__summary {
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
  }

  .pagination__total {
    color: var(--muted, #666);
  }

  .pagination__size-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 0.5rem);
    font-size: 0.875rem;
    color: var(--text-secondary, #888);
  }

  .pagination__size-select {
    padding: var(--spacing-xs, 0.25rem) var(--spacing-sm, 0.5rem);
    background: var(--bg-dark, #1a1a1a);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-sm, 4px);
    color: var(--text, #f9f9f9);
    min-width: 60px;
  }

  .pagination__controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pagination__btn {
    min-width: 36px;
    height: 36px;
    padding: 0 var(--spacing-sm, 0.5rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-dark, #1a1a1a);
    border: 1px solid var(--border, #333);
    border-radius: var(--radius-sm, 4px);
    color: var(--text, #f9f9f9);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .pagination__btn:hover:not(:disabled) {
    background: var(--border, #333);
  }

  .pagination__btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .pagination__btn--active {
    background: var(--accent, #edae49);
    border-color: var(--accent, #edae49);
    color: #000;
    font-weight: 700;
  }

  .pagination__btn--active:hover {
    background: var(--accent, #edae49);
  }

  .pagination__ellipsis {
    padding: 0 var(--spacing-xs, 0.25rem);
    color: var(--text-secondary, #888);
    user-select: none;
  }
</style>
