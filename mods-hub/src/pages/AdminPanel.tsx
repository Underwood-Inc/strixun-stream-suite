/**
 * Admin Panel - High-Performance Mod Triage Interface
 * 
 * Features:
 * - Virtualized table (handles thousands of records)
 * - Sortable columns
 * - Advanced search with human-friendly query parser
 * - Bulk selection and actions
 * - Status management
 * - Export functionality (CSV/JSON)
 * - Stats dashboard
 * - Optimized for performance
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AdvancedSearchInput } from '@strixun/search-query-parser/react';
import { VirtualizedTable, type Column } from '@strixun/virtualized-table';
import { ActionMenu, type ActionMenuItem } from '@strixun/shared-components/react/ActionMenu';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { AdminStats } from '../components/admin/AdminStats';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useAdminDeleteMod, useAdminModsList, useUpdateModStatus } from '../hooks/useMods';
import { colors, spacing } from '../theme/index';
import type { ModMetadata, ModStatus } from '../types/mod';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles } from '../utils/sharedStyles';
import { getStatusBadgeType } from '../utils/badgeHelpers';
import { exportModsToCSV, exportModsToJSON } from '../utils/exportMods';
import { filterModsBySearchQuery } from '../utils/searchMods';

// Lazy load dice board game to avoid loading if not needed
const DiceBoardGameContainer = React.lazy(() => 
  import('@strixun/dice-board-game/react').then(module => ({
    default: module.DiceBoardGameContainer,
  }))
);

const PageContainer = styled.div`
  max-width: 1800px;
  margin: 0 auto;
  padding: ${spacing.md} ${spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  height: calc(100vh - 120px);
  overflow: hidden;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  flex-shrink: 0;
`;

const SearchContainer = styled.div`
  min-width: 250px;
  flex: 1;
  max-width: 400px;
  display: flex;
  align-items: center;
  
  /* Ensure the input wrapper aligns properly */
  > div {
    width: 100%;
  }
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;
`;

const Toolbar = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
  flex-wrap: wrap;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border-radius: 6px;
  border: 1px solid ${colors.border};
  flex-shrink: 0;
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  
  padding: ${spacing.xs} ${spacing.sm};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${props => {
    if (props.$variant === 'primary') return colors.accent;
    if (props.$variant === 'danger') return colors.danger;
    return colors.bgTertiary;
  }};
  color: ${props => props.$variant === 'primary' || props.$variant === 'danger' ? '#fff' : colors.text};
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  line-height: 1.4;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span<{ status: ModStatus }>`
  ${({ status }) => getBadgeStyles(getStatusBadgeType(status))}
`;

const ActionGroup = styled.div`
  display: flex;
  gap: ${spacing.xs};
  flex-wrap: wrap;
  align-items: center;
`;

const StyledLink = styled(Link)`
  color: ${colors.accent};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const SelectionInfo = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  padding: ${spacing.xs};
  margin-right: ${spacing.xs};
`;

const Loading = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

const Error = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.danger};
`;

const TableContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* Critical for flex child to shrink properly */
`;

const TestSection = styled.div`
  margin-top: ${spacing.lg};
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 6px;
`;

const TestSectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.md};
  cursor: pointer;
  user-select: none;
`;

const TestSectionTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const TestSectionContent = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'block' : 'none'};
  height: ${props => props.$isOpen ? '600px' : '0'};
  transition: height 0.3s ease;
  overflow: hidden;
`;

const GameContainer = styled.div`
  width: 100%;
  height: 100%;
  border: 2px solid ${colors.border};
  border-radius: 6px;
  overflow: hidden;
  background: ${colors.bg};
`;

export function AdminPanel() {
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<ModStatus | 'delete' | null>(null);
    const [modToDelete, setModToDelete] = useState<{ modId: string; title: string } | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const [testSectionOpen, setTestSectionOpen] = useState(false);
    const gameContainerRef = useRef<HTMLDivElement>(null);
    
    // Memoized game configs to prevent re-renders
    const gameConfig = useMemo(() => ({
        width: 15,
        height: 15,
        tileSize: 1,
        wrapEdges: true,
        forkProbability: 0.3,
        minForkChainLength: 5,
    }), []);
    
    const diceConfig = useMemo(() => ({
        sides: 6,
        count: 2,
        size: 0.5,
        material: 'standard' as const,
    }), []);
    
    // Memoized callbacks to prevent re-renders
    const handleGameStateChange = useCallback((state: unknown) => {
        console.log('[Dice Board Game] State changed:', state);
    }, []);
    
    const handleGameEvent = useCallback((event: unknown) => {
        console.log('[Dice Board Game] Event triggered:', event);
    }, []);
    
    const { data, isLoading, error } = useAdminModsList({
        page: 1,
        pageSize: 1000, // Load more for admin panel
        status: statusFilter || undefined,
    });

    const updateStatus = useUpdateModStatus();
    const deleteMod = useAdminDeleteMod();

    // Filter and sort mods - MEMOIZED for performance
    const { filteredMods, sortedMods } = useMemo(() => {
        if (isLoading || error || !data) {
            console.log('[AdminPanel] Early return:', { isLoading, error: !!error, hasData: !!data });
            return { filteredMods: [], sortedMods: [] };
        }
        
        // Defensive check: ensure data.mods is an array
        if (!Array.isArray(data.mods)) {
            console.error('[AdminPanel] data.mods is not an array:', { data, modsType: typeof data.mods });
            return { filteredMods: [], sortedMods: [] };
        }
        
        let mods = data.mods;
        console.log('[AdminPanel] Starting with mods:', { count: mods.length, statusFilter, searchQuery });
        
        // Filter by status
        if (statusFilter) {
            const beforeCount = mods.length;
            mods = mods.filter(m => m.status === statusFilter);
            console.log('[AdminPanel] After status filter:', { beforeCount, afterCount: mods.length, statusFilter });
        }
        
        // Filter by search query
        if (searchQuery.trim()) {
            const beforeCount = mods.length;
            mods = filterModsBySearchQuery(mods, searchQuery);
            console.log('[AdminPanel] After search filter:', { beforeCount, afterCount: mods.length, searchQuery });
        }
        
        const filtered = mods;
        
        // Sort mods
        const sorted = [...filtered];
        if (sortConfig) {
            sorted.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof ModMetadata];
                const bVal = b[sortConfig.key as keyof ModMetadata];
                
                // Handle null/undefined values
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;
                
                let comparison = 0;
                if (aVal < bVal) comparison = -1;
                if (aVal > bVal) comparison = 1;
                
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        
        console.log('[AdminPanel] Final result:', { filteredCount: filtered.length, sortedCount: sorted.length });
        return { filteredMods: filtered, sortedMods: sorted };
    }, [data, statusFilter, searchQuery, sortConfig, isLoading, error]);

    // Handle sort
    const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
    }, []);

    // Handle status change
    const handleStatusChange = useCallback(async (modId: string, newStatus: ModStatus, reason?: string) => {
        await updateStatus.mutateAsync({ modId, status: newStatus, reason });
    }, [updateStatus]);

    // Bulk actions
    const handleBulkAction = useCallback(async (action: ModStatus | 'delete') => {
        if (selectedIds.size === 0) return;
        
        const modsToUpdate = sortedMods.filter(mod => selectedIds.has(mod.modId));
        
        try {
            if (action === 'delete') {
                // Delete all selected mods
                for (const mod of modsToUpdate) {
                    await deleteMod.mutateAsync(mod.modId);
                }
            } else {
                // Update status for all selected mods
                for (const mod of modsToUpdate) {
                    await updateStatus.mutateAsync({ modId: mod.modId, status: action });
                }
            }
            setSelectedIds(new Set());
            setBulkActionModalOpen(false);
        } catch {
            // Error handled by mutations
        }
    }, [selectedIds, sortedMods, deleteMod, updateStatus]);

    const handleDeleteClick = useCallback((modId: string, title: string) => {
        setModToDelete({ modId, title });
        setDeleteModalOpen(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!modToDelete) return;
        try {
            await deleteMod.mutateAsync(modToDelete.modId);
            setDeleteModalOpen(false);
            setModToDelete(null);
        } catch {
            // Error is handled by the mutation's onError
        }
    }, [modToDelete, deleteMod]);

    // Export functions
    const handleExportCSV = useCallback(() => {
        exportModsToCSV(sortedMods, `mods-export-${new Date().toISOString().split('T')[0]}.csv`);
    }, [sortedMods]);

    const handleExportJSON = useCallback(() => {
        exportModsToJSON(sortedMods, `mods-export-${new Date().toISOString().split('T')[0]}.json`);
    }, [sortedMods]);

    // Table columns definition
    const columns: Column<ModMetadata>[] = useMemo(() => [
        {
            key: 'title',
            label: 'Title',
            width: '300px',
            sortable: true,
            render: (mod) => (
                <StyledLink to={`/${mod.slug}`}>
                    {mod.title}
                </StyledLink>
            ),
        },
        {
            key: 'authorDisplayName',
            label: 'Author',
            width: '200px',
            sortable: true,
            render: (mod) => mod.authorDisplayName || 'Unknown User',
        },
        {
            key: 'status',
            label: 'Status',
            width: '120px',
            sortable: true,
            render: (mod) => <StatusBadge status={mod.status}>{mod.status}</StatusBadge>,
        },
        {
            key: 'category',
            label: 'Category',
            width: '120px',
            sortable: true,
        },
        {
            key: 'downloadCount',
            label: 'Downloads',
            width: '100px',
            sortable: true,
            render: (mod) => mod.downloadCount.toLocaleString(),
        },
        {
            key: 'createdAt',
            label: 'Created',
            width: '120px',
            sortable: true,
            render: (mod) => new Date(mod.createdAt).toLocaleDateString(),
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '80px',
            render: (mod) => {
                const menuItems: ActionMenuItem[] = [
                    {
                        key: 'review',
                        label: 'Review',
                        icon: '👁',
                        onClick: () => window.open(`/${mod.slug}/review`, '_blank'),
                    },
                    {
                        key: 'approve',
                        label: 'Approve',
                        icon: '✓',
                        onClick: () => handleStatusChange(mod.modId, 'approved'),
                        disabled: updateStatus.isPending || mod.status === 'approved',
                        variant: 'primary',
                        divider: true,
                    },
                    {
                        key: 'changes',
                        label: 'Request Changes',
                        icon: '✎',
                        onClick: () => handleStatusChange(mod.modId, 'changes_requested'),
                        disabled: updateStatus.isPending || mod.status === 'changes_requested',
                    },
                    {
                        key: 'deny',
                        label: 'Deny',
                        icon: '✗',
                        onClick: () => handleStatusChange(mod.modId, 'denied'),
                        disabled: updateStatus.isPending || mod.status === 'denied',
                        variant: 'danger',
                        divider: true,
                    },
                    {
                        key: 'delete',
                        label: 'Delete Permanently',
                        icon: '🗑',
                        onClick: () => handleDeleteClick(mod.modId, mod.title),
                        disabled: deleteMod.isPending,
                        variant: 'danger',
                    },
                ];
                
                return <ActionMenu items={menuItems} />;
            },
        },
    ], [handleStatusChange, handleDeleteClick, updateStatus, deleteMod]);


    if (isLoading) return <Loading>Loading mods...</Loading>;
    if (error) return <Error>Failed to load mods: {(error as Error).message}</Error>;
    
    // Debug logging
    console.log('[AdminPanel] Render state:', {
        hasData: !!data,
        modsCount: data?.mods?.length ?? 0,
        isArray: Array.isArray(data?.mods),
        statusFilter,
        searchQuery,
        sortedModsCount: sortedMods.length,
        filteredModsCount: filteredMods.length
    });

    const selectedCount = selectedIds.size;
    const hasSelection = selectedCount > 0;

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>Mod Triage</Title>
            </PageHeader>

            <AdminStats mods={data?.mods || []} filteredMods={filteredMods} />

            <Toolbar>
                <SearchContainer>
                    <AdvancedSearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder='Search mods... (use "quotes" for exact, space for AND, | for OR)'
                        showHint={false}
                    />
                </SearchContainer>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="changes_requested">Changes Requested</option>
                    <option value="denied">Denied</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                </Select>
                {hasSelection && (
                    <>
                        <SelectionInfo>{selectedCount} selected</SelectionInfo>
                        <Button
                            $variant="primary"
                            onClick={() => {
                                setBulkAction('approved');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateStatus.isPending}
                        >
                            Bulk Approve
                        </Button>
                        <Button
                            onClick={() => {
                                setBulkAction('denied');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateStatus.isPending}
                        >
                            Bulk Deny
                        </Button>
                        <Button
                            $variant="danger"
                            onClick={() => {
                                setBulkAction('delete');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={deleteMod.isPending}
                        >
                            Bulk Delete
                        </Button>
                        <Button onClick={() => setSelectedIds(new Set())}>
                            Clear Selection
                        </Button>
                    </>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: spacing.xs }}>
                    <Button onClick={handleExportCSV} disabled={sortedMods.length === 0}>
                        Export CSV
                    </Button>
                    <Button onClick={handleExportJSON} disabled={sortedMods.length === 0}>
                        Export JSON
                    </Button>
                </div>
            </Toolbar>

            <TableContainer ref={tableContainerRef}>
                {sortedMods.length > 0 ? (
                    <VirtualizedTable
                        data={sortedMods}
                        columns={columns}
                        height="100%"
                        rowHeight={56}
                        getItemId={(mod) => mod.modId}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        colors={colors}
                    />
                ) : (
                    <Loading>
                        {searchQuery.trim() 
                            ? `No mods found matching "${searchQuery}"${statusFilter ? ` with status: ${statusFilter}` : ''}`
                            : `No mods found${statusFilter ? ` with status: ${statusFilter}` : ''}`
                        }
                    </Loading>
                )}
            </TableContainer>

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setModToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="Delete Mod"
                message={`Are you sure you want to delete "${modToDelete?.title}"? This action cannot be undone and will permanently delete the mod and all its versions.`}
                confirmText="Delete Mod"
                cancelText="Cancel"
                isLoading={deleteMod.isPending}
            />

            <ConfirmationModal
                isOpen={bulkActionModalOpen}
                onClose={() => {
                    setBulkActionModalOpen(false);
                    setBulkAction(null);
                }}
                onConfirm={() => {
                    if (bulkAction) {
                        void handleBulkAction(bulkAction);
                    }
                }}
                title={bulkAction === 'delete' ? 'Bulk Delete Mods' : bulkAction ? `Bulk ${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Mods` : 'Bulk Action'}
                message={
                    bulkAction === 'delete'
                        ? `Are you sure you want to delete ${selectedCount} mod(s)? This action cannot be undone.`
                        : bulkAction
                            ? `Are you sure you want to set ${selectedCount} mod(s) to status "${bulkAction}"?`
                            : ''
                }
                confirmText={bulkAction === 'delete' ? 'Delete All' : 'Update All'}
                cancelText="Cancel"
                isLoading={updateStatus.isPending || deleteMod.isPending}
            />

            {/* Test Section - Dice Board Game */}
            <TestSection>
                <TestSectionHeader onClick={() => setTestSectionOpen(!testSectionOpen)}>
                    <TestSectionTitle>Test: Dice Board Game (Experimental)</TestSectionTitle>
                    <Button $variant="secondary" onClick={(e) => {
                        e.stopPropagation();
                        setTestSectionOpen(!testSectionOpen);
                    }}>
                        {testSectionOpen ? 'Hide' : 'Show'}
                    </Button>
                </TestSectionHeader>
                <TestSectionContent $isOpen={testSectionOpen}>
                    <GameContainer ref={gameContainerRef}>
                        <React.Suspense fallback={<div style={{ padding: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>Loading dice board game...</div>}>
                            {testSectionOpen && (
                                <DiceBoardGameContainer
                                    containerRef={gameContainerRef as React.RefObject<HTMLElement>}
                                    width="100%"
                                    height="600px"
                                    config={gameConfig}
                                    diceConfig={diceConfig}
                                    onStateChange={handleGameStateChange}
                                    onEventTriggered={handleGameEvent}
                                />
                            )}
                        </React.Suspense>
                    </GameContainer>
                </TestSectionContent>
            </TestSection>
        </PageContainer>
    );
}
