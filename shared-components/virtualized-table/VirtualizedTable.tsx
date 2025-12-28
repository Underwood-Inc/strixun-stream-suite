/**
 * High-Performance Virtualized Table Component
 * 
 * Agnostic, composable table component that handles thousands of rows efficiently.
 * Uses react-window for virtualization. Framework-agnostic styling via props.
 * 
 * @example
 * <VirtualizedTable
 *   data={items}
 *   columns={columns}
 *   height={600}
 *   getItemId={(item) => item.id}
 *   onRowClick={(item) => console.log(item)}
 * />
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
  accessor?: (item: T) => string | number | Date;
}

export interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  height: number;
  onRowClick?: (item: T, index: number) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  getItemId: (item: T) => string;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  // Styling props - agnostic, can be overridden
  className?: string;
  headerClassName?: string;
  rowClassName?: string;
  cellClassName?: string;
  // Style objects for complete control
  containerStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  rowStyle?: React.CSSProperties;
  cellStyle?: React.CSSProperties;
  // Theme colors (optional - defaults provided)
  colors?: {
    bg?: string;
    bgSecondary?: string;
    bgTertiary?: string;
    border?: string;
    text?: string;
    textSecondary?: string;
    accent?: string;
  };
}

const defaultColors = {
  bg: '#1a1a1a',
  bgSecondary: '#252525',
  bgTertiary: '#2d2d2d',
  border: '#3a3a3a',
  text: '#f9f9f9',
  textSecondary: '#b0b0b0',
  accent: '#d4af37',
};

export function VirtualizedTable<T extends Record<string, any>>({
  data,
  columns,
  rowHeight = 48,
  height,
  onRowClick,
  selectedIds = new Set(),
  onSelectionChange,
  getItemId,
  sortConfig,
  onSort,
  className = '',
  headerClassName = '',
  rowClassName = '',
  cellClassName = '',
  containerStyle = {},
  headerStyle = {},
  rowStyle = {},
  cellStyle = {},
  colors: customColors = {}
}: VirtualizedTableProps<T>) {
  const listRef = useRef<FixedSizeList>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const colors = { ...defaultColors, ...customColors };
  
  // Generate grid template columns
  const gridTemplateColumns = useMemo(() => {
    return columns.map(col => col.width || '1fr').join(' ');
  }, [columns]);
  
  // Handle row selection
  const handleSelect = useCallback((item: T, checked: boolean) => {
    if (!onSelectionChange) return;
    const id = getItemId(item);
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange, getItemId]);
  
  // Handle header click for sorting
  const handleSort = useCallback((key: string) => {
    if (!onSort) return;
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;
    
    if (sortConfig?.key === key) {
      // Toggle direction
      onSort(key, sortConfig.direction === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort
      onSort(key, 'asc');
    }
  }, [columns, sortConfig, onSort]);
  
  // Render row
  const RowComponent = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = data[index];
    if (!item) return null;
    
    const id = getItemId(item);
    const isSelected = selectedIds.has(id);
    const isHovered = hoveredIndex === index;
    
    const rowBgColor = isSelected 
      ? `${colors.accent}15` 
      : isHovered 
        ? colors.bgTertiary 
        : 'transparent';
    
    return (
      <div
        style={{
          ...style,
          ...rowStyle,
          display: 'grid',
          gridTemplateColumns: onSelectionChange ? `50px ${gridTemplateColumns}` : gridTemplateColumns,
          borderBottom: `1px solid ${colors.border}`,
          background: rowBgColor,
          transition: 'background 0.1s ease',
          cursor: onRowClick ? 'pointer' : 'default',
        }}
        className={rowClassName}
        onClick={() => onRowClick?.(item, index)}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {onSelectionChange && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '50px',
              minWidth: '50px',
              padding: '12px',
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                handleSelect(item, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: colors.accent,
              }}
            />
          </div>
        )}
        {columns.map((column) => (
          <div
            key={column.key}
            style={{
              padding: '12px',
              color: colors.textSecondary,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              width: column.width || 'auto',
              minWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...cellStyle,
            }}
            className={cellClassName}
          >
            {column.render ? column.render(item, index) : (item[column.key] ?? '')}
          </div>
        ))}
      </div>
    );
  }, [data, columns, gridTemplateColumns, selectedIds, hoveredIndex, onRowClick, onSelectionChange, getItemId, handleSelect, colors, rowStyle, rowClassName, cellStyle, cellClassName]);
  
  // Adjust header grid if selection is enabled
  const headerGridColumns = useMemo(() => {
    return onSelectionChange 
      ? `50px ${gridTemplateColumns}`
      : gridTemplateColumns;
  }, [onSelectionChange, gridTemplateColumns]);
  
  const sortIndicator = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.bgSecondary,
        borderRadius: '8px',
        overflow: 'hidden',
        height: `${height}px`,
        ...containerStyle,
      }}
      className={className}
    >
      <div
        style={{
          display: 'grid',
          background: colors.bgTertiary,
          borderBottom: `1px solid ${colors.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gridTemplateColumns: headerGridColumns,
          ...headerStyle,
        }}
        className={headerClassName}
      >
        {onSelectionChange && (
          <div
            style={{
              padding: '12px',
              textAlign: 'left',
              fontWeight: 600,
              color: colors.text,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '50px',
              minWidth: '50px',
            }}
          >
            <input
              type="checkbox"
              checked={data.length > 0 && selectedIds.size === data.length}
              onChange={(e) => {
                if (e.target.checked) {
                  const allIds = new Set(data.map(getItemId));
                  onSelectionChange(allIds);
                } else {
                  onSelectionChange(new Set());
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: colors.accent,
              }}
            />
          </div>
        )}
        {columns.map((column) => {
          const isSorted = sortConfig?.key === column.key;
          const isSortable = column.sortable;
          
          return (
            <div
              key={column.key}
              style={{
                padding: '12px',
                textAlign: 'left',
                fontWeight: 600,
                color: colors.text,
                fontSize: '0.875rem',
                cursor: isSortable ? 'pointer' : 'default',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.2s ease',
                width: column.width || 'auto',
                minWidth: '100px',
                ...(isSortable && {
                  ':hover': {
                    background: colors.bgSecondary,
                  },
                }),
              }}
              onClick={() => handleSort(column.key)}
              onMouseEnter={(e) => {
                if (isSortable) {
                  e.currentTarget.style.background = colors.bgSecondary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {column.label}
              {isSortable && (
                <span
                  style={{
                    fontSize: '0.7em',
                    opacity: isSorted ? 1 : 0.3,
                    marginLeft: 'auto',
                  }}
                >
                  {sortIndicator(column.key) || '▲'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FixedSizeList
          ref={listRef}
          height={height - 50} // Subtract header height
          itemCount={data.length}
          itemSize={rowHeight}
          width="100%"
        >
          {RowComponent}
        </FixedSizeList>
      </div>
    </div>
  );
}