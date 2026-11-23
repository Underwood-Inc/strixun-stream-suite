<script lang="ts">
  import '../../styles/ShortUrlWorkspace.css';
  import AdvancedSearchInput from '@strixun/search-query-parser/svelte';
  import DataTable from '../DataTable.svelte';
  import type { DataTableColumn } from '../DataTable.svelte';
  import ShortUrlHostBreakdown from './ShortUrlHostBreakdown.svelte';
  import ShortUrlRowActions from './ShortUrlRowActions.svelte';
  import {
    shortUrlListWorkspace,
    sortHeaderFromSortId,
    toggleShortUrlListSortId,
    hostViewBarSeries,
    summaryHostBarSeries,
    type ShortUrlListRow,
    type ShortenerPublicHostRow,
    type AnalyticsSummaryByHost,
  } from '@strixun/url-shortener-core';

  interface Props {
    rows: ShortUrlListRow[];
    catalog: readonly ShortenerPublicHostRow[];
    summaryByHost?: readonly AnalyticsSummaryByHost[];
    isLoading?: boolean;
    onCopy?: (shortUrl: string) => void;
    onDelete?: (shortCode: string) => void;
  }

  let {
    rows,
    catalog,
    summaryByHost = [],
    isLoading = false,
    onCopy,
    onDelete,
  }: Props = $props();

  let query = $state('');
  let sortId = $state('viewed-desc');
  let selectedRow = $state<ShortUrlListRow | null>(null);

  const workspace = $derived(shortUrlListWorkspace({ rows, query, sortId, catalog }));
  const sortHeader = $derived(sortHeaderFromSortId(sortId));

  function handleColumnSort(columnId: string) {
    sortId = toggleShortUrlListSortId(sortId, columnId);
  }

  const summarySeries = $derived(
    summaryHostBarSeries(
      summaryByHost.map((h) => ({
        hostKey: h.hostKey,
        label: h.label,
        views: h.views,
      })),
      catalog,
    ),
  );

  const detailSeries = $derived(
    selectedRow ? hostViewBarSeries(selectedRow.viewsByHostKey, catalog) : [],
  );

  function formatLastViewed(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  const tableColumns: DataTableColumn<ShortUrlListRow>[] = $derived([
    {
      accessorKey: 'shortUrl',
      header: 'Short link',
      size: 220,
      enableSorting: true,
      cell: ({ row }) => row.shortUrl,
    },
    {
      accessorKey: 'url',
      header: 'Destination',
      size: 260,
      cell: ({ row }) => (row.url.length > 48 ? `${row.url.slice(0, 48)}…` : row.url),
    },
    {
      accessorKey: 'clickCount',
      header: 'Clicks',
      size: 72,
      enableSorting: true,
      cell: ({ row }) => String(row.clickCount ?? 0),
    },
    {
      id: 'lastViewedAt',
      header: 'Last used',
      size: 140,
      enableSorting: true,
      cell: ({ row }) => formatLastViewed(row.lastViewedAt),
    },
    {
      id: 'actions',
      header: '',
      size: 96,
      svelteCell: ShortUrlRowActions,
      svelteCellProps: (row) => ({
        row,
        onCopy,
        onDelete,
      }),
    },
  ]);
</script>

<section class="short-url-workspace" aria-labelledby="short-url-list-heading">
  <div class="short-url-workspace__toolbar">
    <AdvancedSearchInput
      value={query}
      onInput={(v) => (query = v)}
      placeholder='Search codes and URLs ("phrase", space=AND, |=OR)'
    />
  </div>

  <div class="short-url-workspace__layout">
    <div>
      <h2 id="short-url-list-heading" class="visually-hidden">Your short URLs</h2>
      {#if isLoading}
        <p>Loading URLs…</p>
      {:else}
        <div class="short-url-workspace__table-wrap">
          <DataTable
            data={workspace.sorted}
            columns={tableColumns}
            getRowId={(row) => row.shortCode}
            enableSorting={false}
            externalSortColumnId={sortHeader.columnId}
            externalSortDirection={sortHeader.direction}
            onExternalColumnSort={handleColumnSort}
            enableVirtualization={workspace.sorted.length > 20}
            rowHeight={52}
            emptyMessage={query ? 'No links match your search.' : 'No short URLs yet.'}
            onRowClick={(row) => (selectedRow = row as ShortUrlListRow)}
          />
        </div>
        {#if selectedRow}
          <div class="short-url-workspace__detail">
            <strong>{selectedRow.shortUrl}</strong>
            <ShortUrlHostBreakdown series={detailSeries} />
          </div>
        {/if}
      {/if}
    </div>

    <aside class="short-url-workspace__insights">
      <div class="short-url-workspace__summary">
        <h3>Views by domain</h3>
        <ShortUrlHostBreakdown series={summarySeries} compact />
      </div>
      <div class="short-url-workspace__insights-panel">
        <h3>Top by clicks</h3>
        <ul class="short-url-workspace__insight-list">
          {#each workspace.topByClicks as link (link.shortCode)}
            <li>
              <strong>{link.shortCode}</strong>
              <span>{link.clickCount}</span>
            </li>
          {/each}
        </ul>
        <h3>Recently used</h3>
        <ul class="short-url-workspace__insight-list">
          {#each workspace.topByRecency as link (link.shortCode)}
            <li>
              <strong>{link.shortCode}</strong>
              <span>{formatLastViewed(link.lastViewedAt)}</span>
            </li>
          {/each}
        </ul>
      </div>
    </aside>
  </div>
</section>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>