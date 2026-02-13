<script lang="ts">
/**
 * DataTable Component - Svelte Implementation
 * Framework-agnostic, highly scalable, composable table component
 * Uses TanStack Table + TanStack Virtual for performance
 * 
 * Features:
 * - Virtualized rows (thousands of rows with no performance hit)
 * - Sorting, filtering, selection
 * - Pagination and infinite scroll support
 * - Fully customizable styling
 * - Sticky headers with synced horizontal scroll
 */

import { onMount } from 'svelte';
import {
  createSvelteTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type TableOptions,
} from '@tanstack/svelte-table';
import { createVirtualizer } from '@tanstack/svelte-virtual';

// ============ TYPES ============

export interface DataTableColumn<T> {
  id?: string;
  accessorKey?: string;
  header: string | ((props: any) => any);
  cell?: (props: { row: T; value: any; rowIndex: number }) => any;
  size?: number;
  enableSorting?: boolean;
}

interface $$Props {
  data: any[];
  columns: DataTableColumn<any>[];
  rowHeight?: number;
  enableSorting?: boolean;
  enableSelection?: boolean;
  enableVirtualization?: boolean;
  onRowClick?: (row: any, rowIndex: number) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  getRowId: (row: any) => string;
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

export let data: any[];
export let columns: DataTableColumn<any>[];
export let rowHeight = 52;
export let enableSorting = true;
export let enableSelection = false;
export let enableVirtualization = true;
export let onRowClick: ((row: any, rowIndex: number) => void) | undefined = undefined;
export let selectedIds: Set<string> = new Set();
export let onSelectionChange: ((selectedIds: Set<string>) => void) | undefined = undefined;
export let getRowId: (row: any) => string;
let className = '';
export { className as class };
export let emptyMessage = 'No data available';
export let colors: $$Props['colors'] = undefined;

// Default colors
const defaultColors = {
  bgPrimary: '#0f0f0f',
  bgSecondary: '#1a1a1a',
  bgTertiary: '#0f0f0f',
  border: '#333',
  text: '#f9f9f9',
  textMuted: '#888',
  accent: '#edae49',
};

$: finalColors = { ...defaultColors, ...colors };

// Refs
let tableContainerRef: HTMLDivElement;
let headerScrollRef: HTMLDivElement;
let bodyScrollRef: HTMLDivElement;

// State
let sorting: SortingState = [];
let rowSelection: Record<string, boolean> = {};

// Update row selection when selectedIds changes
$: {
  if (enableSelection && selectedIds) {
    const selectionObj: Record<string, boolean> = {};
    data.forEach((row, index) => {
      const id = getRowId(row);
      if (selectedIds.has(id)) {
        selectionObj[index.toString()] = true;
      }
    });
    rowSelection = selectionObj;
  }
}

// Prepare columns with selection column if needed
$: tableColumns = (() => {
  const cols: ColumnDef<any>[] = [];
  
  if (enableSelection && onSelectionChange) {
    cols.push({
      id: 'select',
      size: 50,
      header: ({ table }: any) => {
        const checked = table.getIsAllRowsSelected();
        return {
          component: 'checkbox',
          props: { checked, onChange: table.getToggleAllRowsSelectedHandler() }
        };
      },
      cell: ({ row }: any) => {
        const checked = row.getIsSelected();
        return {
          component: 'checkbox',
          props: { checked, onChange: row.getToggleSelectedHandler() }
        };
      },
    });
  }
  
  // Convert DataTableColumn to TanStack ColumnDef
  cols.push(...columns.map(col => ({
    ...col,
    cell: col.cell ? (info: any) => col.cell!({
      row: info.row.original,
      value: info.getValue(),
      rowIndex: info.row.index
    }) : undefined,
  })));
  
  return cols;
})();

// TanStack Table options
$: options: TableOptions<any> = {
  data,
  columns: tableColumns,
  state: {
    sorting,
    rowSelection,
  },
  enableSorting,
  enableRowSelection: enableSelection,
  onSortingChange: (updater) => {
    sorting = typeof updater === 'function' ? updater(sorting) : updater;
  },
  onRowSelectionChange: (updater) => {
    rowSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
    
    // Sync selection changes to parent
    if (enableSelection && onSelectionChange) {
      const selectedRowIds = new Set<string>();
      Object.keys(rowSelection).forEach(indexStr => {
        if (rowSelection[indexStr]) {
          const row = data[parseInt(indexStr)];
          if (row) {
            selectedRowIds.add(getRowId(row));
          }
        }
      });
      onSelectionChange(selectedRowIds);
    }
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
  getRowId: (row, index) => getRowId(row),
};

// Create table instance
$: table = createSvelteTable(options);

// Get rows
$: rows = $table.getRowModel().rows;

// Virtualization
$: rowVirtualizer = enableVirtualization && bodyScrollRef ? createVirtualizer({
  count: rows.length,
  getScrollElement: () => bodyScrollRef,
  estimateSize: () => rowHeight,
  overscan: 5,
}) : null;

$: virtualRows = rowVirtualizer ? $rowVirtualizer.getVirtualItems() : null;
$: totalSize = rowVirtualizer ? $rowVirtualizer.getTotalSize() : rows.length * rowHeight;

// Sync horizontal scroll between header and body
function handleBodyScroll() {
  if (headerScrollRef && bodyScrollRef) {
    headerScrollRef.scrollLeft = bodyScrollRef.scrollLeft;
  }
}

// Handle row click
function handleRowClickInternal(row: any, rowIndex: number) {
  if (onRowClick) {
    onRowClick(row, rowIndex);
  }
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
    <!-- Header -->
    <div class="header-scroll-container" bind:this={headerScrollRef}>
      <div class="table-header" style="background: {finalColors.bgTertiary}; border-color: {finalColors.border};">
        {#each $table.getHeaderGroups() as headerGroup}
          {#each headerGroup.headers as header}
            <div
              class="header-cell"
              class:sortable={enableSorting && header.column.getCanSort()}
              style="color: {finalColors.text}; flex: 0 0 {header.column.getSize()}px; min-width: {header.column.getSize()}px;"
              on:click={enableSorting && header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
              on:keydown={(e) => e.key === 'Enter' && enableSorting && header.column.getCanSort() ? header.column.getToggleSortingHandler()?.(e) : null}
              role={enableSorting && header.column.getCanSort() ? 'button' : undefined}
              tabindex={enableSorting && header.column.getCanSort() ? 0 : undefined}
            >
              <svelte:component this={flexRender(header.column.columnDef.header, header.getContext())} />
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

    <!-- Body -->
    <div class="body-scroll-container" bind:this={bodyScrollRef} on:scroll={handleBodyScroll}>
      <div class="table-body" style="height: {totalSize}px;">
        {#each (enableVirtualization ? virtualRows : rows.map((row, index) => ({ index, size: rowHeight, start: index * rowHeight }))) as virtualRow}
          {@const row = rows[virtualRow.index]}
          <div
            class="table-row"
            class:selected={row.getIsSelected()}
            style="
              height: {virtualRow.size}px;
              transform: translateY({virtualRow.start}px);
              background: {row.getIsSelected() ? `${finalColors.accent}15` : 'transparent'};
              border-color: {finalColors.border};
            "
            on:click={() => handleRowClickInternal(row.original, virtualRow.index)}
            on:keydown={(e) => e.key === 'Enter' ? handleRowClickInternal(row.original, virtualRow.index) : null}
            role="button"
            tabindex="0"
          >
            {#each row.getVisibleCells() as cell}
              <div
                class="table-cell"
                style="color: {finalColors.text}; flex: 0 0 {cell.column.getSize()}px; min-width: {cell.column.getSize()}px;"
              >
                {#if cell.column.id === 'select'}
                  {@const cellValue = cell.getValue()}
                  {#if cellValue && typeof cellValue === 'object' && cellValue.component === 'checkbox'}
                    <input
                      type="checkbox"
                      checked={cellValue.props.checked}
                      on:change={cellValue.props.onChange}
                      style="accent-color: {finalColors.accent};"
                    />
                  {/if}
                {:else}
                  <svelte:component this={flexRender(cell.column.columnDef.cell, cell.getContext())} />
                {/if}
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

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
</style>
