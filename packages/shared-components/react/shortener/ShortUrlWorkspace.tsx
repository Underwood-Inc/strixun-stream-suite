import { useMemo, useState } from 'react';
import { AdvancedSearchInput } from '@strixun/search-query-parser/react';
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
import { DataTable, type DataTableColumn } from '../DataTable';
import { ShortUrlHostBreakdown } from './ShortUrlHostBreakdown';
import { ShortUrlRowActions } from './ShortUrlRowActions';
import '../../styles/ShortUrlWorkspace.css';

export interface ShortUrlWorkspaceProps {
  rows: ShortUrlListRow[];
  catalog: readonly ShortenerPublicHostRow[];
  summaryByHost?: readonly AnalyticsSummaryByHost[];
  isLoading?: boolean;
  onCopy?: (shortUrl: string) => void;
  onDelete?: (shortCode: string) => void;
}

function formatLastViewed(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function ShortUrlWorkspace({
  rows,
  catalog,
  summaryByHost = [],
  isLoading = false,
  onCopy,
  onDelete,
}: ShortUrlWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [sortId, setSortId] = useState('viewed-desc');
  const [selectedRow, setSelectedRow] = useState<ShortUrlListRow | null>(null);

  const workspace = useMemo(
    () => shortUrlListWorkspace({ rows, query, sortId, catalog }),
    [rows, query, sortId, catalog],
  );

  const sortHeader = useMemo(() => sortHeaderFromSortId(sortId), [sortId]);

  const summarySeries = useMemo(
    () =>
      summaryHostBarSeries(
        summaryByHost.map((h) => ({ hostKey: h.hostKey, label: h.label, views: h.views })),
        catalog,
      ),
    [summaryByHost, catalog],
  );

  const detailSeries = useMemo(
    () => (selectedRow ? hostViewBarSeries(selectedRow.viewsByHostKey, catalog) : []),
    [selectedRow, catalog],
  );

  const columns: DataTableColumn<ShortUrlListRow>[] = useMemo(
    () => [
      {
        accessorKey: 'shortUrl',
        header: 'Short link',
        size: 220,
        enableSorting: true,
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
        cell: ({ row }) => <ShortUrlRowActions row={row} onCopy={onCopy} onDelete={onDelete} />,
      },
    ],
    [onCopy, onDelete],
  );

  return (
    <section className="short-url-workspace">
      <div className="short-url-workspace__toolbar">
        <AdvancedSearchInput value={query} onChange={setQuery} />
      </div>
      <div className="short-url-workspace__layout">
        <div>
          {isLoading ? (
            <p>Loading URLs…</p>
          ) : (
            <>
              <div className="short-url-workspace__table-wrap">
                <DataTable
                  data={workspace.sorted}
                  columns={columns}
                  getRowId={(row) => row.shortCode}
                  enableSorting={false}
                  externalSortColumnId={sortHeader.columnId}
                  externalSortDirection={sortHeader.direction}
                  onExternalColumnSort={(columnId) =>
                    setSortId((prev) => toggleShortUrlListSortId(prev, columnId))
                  }
                  enableVirtualization={workspace.sorted.length > 20}
                  rowHeight={52}
                  emptyMessage={query ? 'No links match your search.' : 'No short URLs yet.'}
                  onRowClick={(row) => setSelectedRow(row)}
                />
              </div>
              {selectedRow ? (
                <div className="short-url-workspace__detail">
                  <strong>{selectedRow.shortUrl}</strong>
                  <ShortUrlHostBreakdown series={detailSeries} />
                </div>
              ) : null}
            </>
          )}
        </div>
        <aside className="short-url-workspace__insights">
          <div className="short-url-workspace__summary">
            <h3>Views by domain</h3>
            <ShortUrlHostBreakdown series={summarySeries} compact />
          </div>
          <div className="short-url-workspace__insights-panel">
            <h3>Top by clicks</h3>
            <ul className="short-url-workspace__insight-list">
              {workspace.topByClicks.map((link) => (
                <li key={link.shortCode}>
                  <strong>{link.shortCode}</strong>
                  <span>{link.clickCount}</span>
                </li>
              ))}
            </ul>
            <h3>Recently used</h3>
            <ul className="short-url-workspace__insight-list">
              {workspace.topByRecency.map((link) => (
                <li key={link.shortCode}>
                  <strong>{link.shortCode}</strong>
                  <span>{formatLastViewed(link.lastViewedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}