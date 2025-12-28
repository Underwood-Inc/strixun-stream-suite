/**
 * High-Performance Virtualized Table Component
 * 
 * Handles thousands of rows efficiently using react-window
 * Supports sorting, selection, and all table features
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  background: ${colors.bgSecondary};
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
`;

const TableHeader = styled.div`
  display: grid;
  background: ${colors.bgTertiary};
  border-bottom: 1px solid ${colors.border};
  position: sticky;
  top: 0;
  z-index: 10;
`;

const HeaderCell = styled.div<{ $sortable?: boolean; $sorted?: 'asc' | 'desc' | null; $width?: string }>`
  padding: ${spacing.md};
  text-align: left;
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: ${props => props.$sortable ? 'pointer' : 'default'};
  user-select: none;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  transition: background 0.2s ease;
  width: ${props => props.$width || 'auto'};
  min-width: 100px;
  
  &:hover {
    background: ${props => props.$sortable ? colors.bgSecondary : 'transparent'};
  }
  
  &::after {
    content: ${props => {
      if (!props.$sortable || !props.$sorted) return '""';
      return props.$sorted === 'asc' ? '"▲"' : '"▼"';
    }};
    font-size: 0.7em;
    opacity: ${props => props.$sorted ? 1 : 0.3};
    margin-left: auto;
  }
`;

const TableBody = styled.div`
  flex: 1;
  overflow: hidden;
`;

const Row = styled.div<{ $selected?: boolean; $hover?: boolean }>`
  display: grid;
  border-bottom: 1px solid ${colors.border};
  background: ${props => props.$selected ? `${colors.accent}15` : 'transparent'};
  transition: background 0.1s ease;
  
  &:hover {
    background: ${props => props.$selected ? `${colors.accent}25` : colors.bgTertiary};
  }
`;

const Cell = styled.div<{ $width?: string }>`
  padding: ${spacing.md};
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  width: ${props => props.$width || 'auto'};
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CheckboxCell = styled(Cell)`
  justify-content: center;
  width: 50px;
  min-width: 50px;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: ${colors.accent};
`;

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
}

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
  onSort
}: VirtualizedTableProps<T>) {
  const listRef = useRef<List>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
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
    
    return (
      <Row
        style={{ ...style, gridTemplateColumns, display: 'grid' }}
        $selected={isSelected}
        $hover={isHovered}
        onClick={() => onRowClick?.(item, index)}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {onSelectionChange && (
          <CheckboxCell>
            <Checkbox
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                handleSelect(item, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </CheckboxCell>
        )}
        {columns.map((column) => (
          <Cell key={column.key} $width={column.width}>
            {column.render ? column.render(item, index) : (item[column.key] ?? '')}
          </Cell>
        ))}
      </Row>
    );
  }, [data, columns, gridTemplateColumns, selectedIds, hoveredIndex, onRowClick, onSelectionChange, getItemId, handleSelect]);
  
  // Adjust header grid if selection is enabled
  const headerGridColumns = useMemo(() => {
    return onSelectionChange 
      ? `50px ${gridTemplateColumns}`
      : gridTemplateColumns;
  }, [onSelectionChange, gridTemplateColumns]);
  
  return (
    <TableContainer style={{ height: `${height}px` }}>
      <TableHeader style={{ gridTemplateColumns: headerGridColumns }}>
        {onSelectionChange && (
          <HeaderCell style={{ width: '50px', minWidth: '50px', justifyContent: 'center' }}>
            <Checkbox
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
            />
          </HeaderCell>
        )}
        {columns.map((column) => (
          <HeaderCell
            key={column.key}
            $sortable={column.sortable}
            $sorted={sortConfig?.key === column.key ? sortConfig.direction : null}
            $width={column.width}
            onClick={() => handleSort(column.key)}
          >
            {column.label}
          </HeaderCell>
        ))}
      </TableHeader>
      <TableBody>
        <List
          ref={listRef}
          height={height - 50} // Subtract header height
          itemCount={data.length}
          itemSize={rowHeight}
          width="100%"
        >
          {RowComponent}
        </List>
      </TableBody>
    </TableContainer>
  );
}

