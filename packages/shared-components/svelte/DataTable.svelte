<script lang="ts">
/**
 * DataTable — Svelte 5 + TanStack Table v9
 */
import { get } from 'svelte/store';
import {
  createTable,
  FlexRender,
  renderComponent,
  tableFeatures,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowSelectionFeature,
  createSortedRowModel,
  sortFns,
  type ColumnDef,
  type RowSelectionState,
} from '@tanstack/svelte-table';
import { createVirtualizer } from '@tanstack/svelte-virtual';
import DataTableSelectCheckbox from './DataTableSelectCheckbox.svelte';

export interface DataTableColumn<T> {
  id?: string;
  accessorKey?: string;
  header: string | ((props: unknown) => unknown);
  cell?: (props: { row: T; value: unknown; rowIndex: number }) => unknown;
  svelteCell?: import('svelte').Component;
  svelteCellProps?: (row: T, rowIndex: number) => Record<string, unknown>;
  size?: number;
  enableSorting?: boolean;
}

interface DataTableProps<T = unknown> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowHeight?: number;
  enableSorting?: boolean;
  enableSelection?: boolean;
  enableVirtualization?: boolean;
  onRowClick?: (row: T, rowIndex: number) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  getRowId: (row: T) => string;
  class?: string;
  emptyMessage?: string;
  colors?: {
    bgPrimary?: string;
    bgSecondary?: string;
    bgTertiary?: string;
    border?: string;
    text?: string;
    textMuted?: string;
    accent?: string;
  };
}

let {
  data,
  columns,
  rowHeight = 52,
  enableSorting = true,
  enableSelection = false,
  enableVirtualization = true,
  onRowClick,
  selectedIds = new Set<string>(),
  onSelectionChange,
  getRowId,
  class: className = '',
  emptyMessage = 'No data available',
  colors,
}: DataTableProps = $props();

const defaultColors = {
  bgPrimary: '#0f0f0f',
  bgSecondary: '#1a1a1a',
  bgTertiary: '#0f0f0f',
  border: '#333',
  text: '#f9f9f9',
  textMuted: '#888',
  accent: '#edae49',
};

const finalColors = $derived({ ...defaultColors, ...colors });

let tableContainerRef = $state<HTMLDivElement | null>(null);
let headerScrollRef = $state<HTMLDivElement | null>(null);
let bodyScrollRef = $state<HTMLDivElement | null>(null);

function buildTanstackColumns(): ColumnDef<unknown>[] {
  const cols: ColumnDef<unknown>[] = [];

  if (enableSelection && onSelectionChange) {
    cols.push({
      id: 'select',
      size: 50,
      header: ({ table: tbl }) =>
        renderComponent(DataTableSelectCheckbox, {
          checked: tbl.getIsAllRowsSelected(),
          onChange: tbl.getToggleAllRowsSelectedHandler(),
        }),
      cell: ({ row }) =>
        renderComponent(DataTableSelectCheckbox, {
          checked: row.getIsSelected(),
          onChange: row.getToggleSelectedHandler(),
        }),
    });
  }

  for (const col of columns) {
    cols.push({
      ...col,
      cell: col.svelteCell
        ? (ctx) =>
            renderComponent(
              col.svelteCell!,
              (col.svelteCellProps?.(ctx.row.original, ctx.row.index) ?? {}) as Record<string, never>,
            )
        : col.cell
          ? (ctx) =>
              col.cell!({
                row: ctx.row.original,
                value: ctx.getValue(),
                rowIndex: ctx.row.index,
              })
          : undefined,
    } as ColumnDef<unknown>);
  }

  return cols;
}

// Core row model is automatic; feature plugins are registered on demand (v9).
const sharedFeatures = {
  rowSortingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
} as const;

const features = tableFeatures(
  enableSelection ? { ...sharedFeatures, rowSelectionFeature } : { ...sharedFeatures },
);

const table = createTable({
  features,
  columns: buildTanstackColumns(),
  data,
  enableSorting,
  enableRowSelection: enableSelection,
  getRowId: (row) => getRowId(row),
});

if (enableSelection && onSelectionChange) {
  table.setOptions((prev) => ({
    ...prev,
    onRowSelectionChange: () => {
      const selection = table.getState().rowSelection as RowSelectionState;
      const selectedRowIds = new Set<string>();
      for (const indexStr of Object.keys(selection)) {
        if (selection[indexStr]) {
          const row = data[Number.parseInt(indexStr, 10)];
          if (row) selectedRowIds.add(getRowId(row));
        }
      }
      onSelectionChange(selectedRowIds);
    },
  }));
}

let rowVirtualizer = $state<ReturnType<typeof createVirtualizer> | null>(null);
let lastDataRef: unknown[] = data;

$effect(() => {
  if (data !== lastDataRef) {
    lastDataRef = data;
    table.setOptions((prev) => ({ ...prev, data }));
  }
});

$effect(() => {
  if (!enableVirtualization || !bodyScrollRef) return;
  rowVirtualizer = createVirtualizer({
    count: data.length,
    getScrollElement: () => bodyScrollRef as HTMLDivElement,
    estimateSize: () => rowHeight,
    overscan: 5,
  });
});

const virtualRows = $derived(
  enableVirtualization && rowVirtualizer
    ? get(rowVirtualizer).getVirtualItems()
    : null,
);
const totalSize = $derived(
  enableVirtualization && rowVirtualizer
    ? get(rowVirtualizer).getTotalSize()
    : data.length * rowHeight,
);

function handleBodyScroll() {
  if (headerScrollRef && bodyScrollRef) {
    headerScrollRef.scrollLeft = bodyScrollRef.scrollLeft;
  }
}

function handleRowClickInternal(row: unknown, rowIndex: number) {
  onRowClick?.(row, rowIndex);
}
</script>

{#if data.length === 0}
  <div class="table-container {className}" style="background: {finalColors.bgSecondary}; border-color: {finalColors.border};">
    <div class="empty-state" style="color: {finalColors.textMuted};">
      {emptyMessage}
    </div>
  </div>
{:else}
  <div class="table-container {className}" bind:this={tableContainerRef} style="background: {finalColors.bgSecondary}; border-color: {finalColors.border};">
    <div class="header-scroll-container" bind:this={headerScrollRef}>
      <div class="table-header" style="background: {finalColors.bgTertiary}; border-color: {finalColors.border};">
        {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
          {#each headerGroup.headers as header (header.id)}
            <div
              class="header-cell"
              class:sortable={enableSorting && header.column.getCanSort()}
              style="color: {finalColors.text}; flex: 0 0 {header.column.getSize()}px; min-width: {header.column.getSize()}px;"
              onclick={enableSorting && header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
              onkeydown={(e) => e.key === 'Enter' && enableSorting && header.column.getCanSort() ? header.column.getToggleSortingHandler()?.(e) : null}
              role={enableSorting && header.column.getCanSort() ? 'button' : undefined}
              tabindex={enableSorting && header.column.getCanSort() ? 0 : undefined}
            >
              <FlexRender header={header} />
              {#if enableSorting && header.column.getCanSort()}
                <span class="sort-indicator" class:sorted={header.column.getIsSorted()}>
                  {header.column.getIsSorted() === 'asc' ? '▲' : '▼'}
                </span>
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    </div>

    <div class="body-scroll-container" bind:this={bodyScrollRef} onscroll={handleBodyScroll}>
      <div class="table-body" style="height: {totalSize}px;">
        {#each (enableVirtualization && virtualRows ? virtualRows : table.getRowModel().rows.map((row, index) => ({ index, size: rowHeight, start: index * rowHeight }))) as virtualRow (virtualRow.index)}
          {@const row = table.getRowModel().rows[virtualRow.index]}
          <div
            class="table-row"
            class:selected={enableSelection && row.getIsSelected()}
            style="
              height: {virtualRow.size}px;
              transform: translateY({virtualRow.start}px);
              background: {enableSelection && row.getIsSelected() ? `${finalColors.accent}15` : 'transparent'};
              border-color: {finalColors.border};
            "
            onclick={() => handleRowClickInternal(row.original, virtualRow.index)}
            onkeydown={(e) => e.key === 'Enter' && handleRowClickInternal(row.original, virtualRow.index)}
            role="button"
            tabindex="0"
          >
            {#each row.getVisibleCells() as cell (cell.id)}
              <div
                class="table-cell"
                style="color: {finalColors.text}; flex: 0 0 {cell.column.getSize()}px; min-width: {cell.column.getSize()}px;"
              >
                <FlexRender cell={cell} />
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .table-container {
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    border: 1px solid;
    overflow: hidden;
    height: 100%;
    min-height: 0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    font-size: 1rem;
  }

  .header-scroll-container {
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .table-header {
    display: flex;
    border-bottom: 1px solid;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-cell {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 0.875rem;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s ease;

    &.sortable {
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    }
  }

  .sort-indicator {
    margin-left: auto;
    opacity: 0.3;
    font-size: 0.7em;

    &.sorted {
      opacity: 1;
    }
  }

  .body-scroll-container {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  .table-body {
    position: relative;
  }

  .table-row {
    display: flex;
    border-bottom: 1px solid;
    cursor: pointer;
    transition: background 0.15s ease;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;

    &:hover {
      background: rgba(255, 255, 255, 0.05) !important;
    }

    &.selected {
      &:hover {
        background: rgba(237, 174, 73, 0.25) !important;
      }
    }
  }

  .table-cell {
    padding: 12px 16px;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
</style>