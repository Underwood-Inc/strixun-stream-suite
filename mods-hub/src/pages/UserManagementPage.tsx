/**
 * User Management Page - Admin Interface for Managing Users
 * 
 * Features:
 * - Virtualized table (handles thousands of records)
 * - Sortable columns
 * - Advanced search with human-friendly query parser
 * - Bulk selection and actions
 * - Permission management
 * - View user details and mods
 * - Optimized for performance
 */

import { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AdvancedSearchInput } from '@strixun/search-query-parser/react';
import { VirtualizedTable, type Column } from '@strixun/virtualized-table';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useUpdateUser, useUsersList } from '../hooks/useUsers';
import { colors, spacing } from '../theme/index';
import type { UserListItem } from '../types/user';
import { filterUsersBySearchQuery } from '../utils/searchUsers';

const PageContainer = styled.div`
  max-width: 1800px;
  margin: 0 auto;
  padding: ${spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  height: calc(100vh - 120px);
  overflow: hidden;
`;

const PageHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
`;

const FiltersSection = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  flex-wrap: wrap;
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border-radius: 8px;
  border: 1px solid ${colors.border};
`;

const SearchContainer = styled.div`
  min-width: 300px;
  flex: 1;
  max-width: 500px;
`;

const ApiStatusBar = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgTertiary};
  border-radius: 4px;
  font-size: 0.75rem;
`;

const StatusIndicator = styled.span<{ status: 'loading' | 'success' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.xs};
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => {
      if (props.status === 'loading') return colors.warning;
      if (props.status === 'error') return colors.danger;
      return colors.success;
    }};
    animation: ${props => props.status === 'loading' ? 'pulse 1.5s ease-in-out infinite' : 'none'};
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const Toolbar = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
  flex-wrap: wrap;
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border-radius: 8px;
  border: 1px solid ${colors.border};
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: ${spacing.xs} ${spacing.sm};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${props => {
    if (props.variant === 'primary') return colors.accent;
    if (props.variant === 'danger') return colors.danger;
    return colors.bgTertiary;
  }};
  color: ${props => props.variant === 'primary' || props.variant === 'danger' ? '#fff' : colors.text};
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PermissionBadge = styled.span<{ hasPermission: boolean }>`
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.hasPermission ? `${colors.success}20` : `${colors.bgTertiary}`};
  color: ${props => props.hasPermission ? colors.success : colors.textSecondary};
`;

const AccountTypeBadge = styled.span<{ type: 'free' | 'subscription' }>`
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.type === 'subscription' ? `${colors.accent}20` : `${colors.bgTertiary}`};
  color: ${props => props.type === 'subscription' ? colors.accent : colors.textSecondary};
`;

const ActionGroup = styled.div`
  display: flex;
  gap: ${spacing.xs};
  flex-wrap: wrap;
`;

const SelectionInfo = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const TableContainer = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: ${colors.bgSecondary};
  border-radius: 8px;
  border: 1px solid ${colors.border};
  overflow: hidden;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xxl};
  text-align: center;
  color: ${colors.textSecondary};
  min-height: 400px;
`;

const StatsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border-radius: 8px;
  border: 1px solid ${colors.border};
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.text};
`;

export function UserManagementPage() {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<'approve' | 'revoke' | null>(null);
    
    const { data, isLoading, error } = useUsersList({
        page: 1,
        pageSize: 1000, // Load more for admin panel
    });

    const updateUser = useUpdateUser();

    // Filter and sort users - MEMOIZED for performance
    const sortedUsers = useMemo(() => {
        if (isLoading || error || !data) return [];
        
        let users = data.users;
        
        // Filter by search query
        if (searchQuery.trim()) {
            users = filterUsersBySearchQuery(users, searchQuery);
        }
        
        // Sort users
        const sorted = [...users];
        if (sortConfig) {
            sorted.sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof UserListItem];
                let bVal: any = b[sortConfig.key as keyof UserListItem];
                
                // Handle computed accountType column
                if (sortConfig.key === 'accountType') {
                    aVal = a.customerId ? 'subscription' : 'free';
                    bVal = b.customerId ? 'subscription' : 'free';
                }
                
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
        
        return sorted;
    }, [data, searchQuery, sortConfig, isLoading, error]);

    // Handle sort
    const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
        setSortConfig({ key, direction });
    }, []);

    // Handle permission toggle
    const handleTogglePermission = useCallback(async (userId: string, hasPermission: boolean) => {
        await updateUser.mutateAsync({
            userId,
            updates: { hasUploadPermission: !hasPermission },
        });
    }, [updateUser]);

    // Bulk actions
    const handleBulkAction = useCallback(async (action: 'approve' | 'revoke') => {
        if (selectedIds.size === 0) return;
        
        const usersToUpdate = sortedUsers.filter(user => selectedIds.has(user.userId));
        
        try {
            for (const user of usersToUpdate) {
                await updateUser.mutateAsync({
                    userId: user.userId,
                    updates: { hasUploadPermission: action === 'approve' },
                });
            }
            setSelectedIds(new Set());
            setBulkActionModalOpen(false);
        } catch {
            // Error handled by mutations
        }
    }, [selectedIds, sortedUsers, updateUser]);

    // Table columns definition
    const columns: Column<UserListItem>[] = useMemo(() => [
        {
            key: 'displayName',
            label: 'Display Name',
            width: '250px',
            sortable: true,
            render: (user) => user.displayName || 'Unknown User',
        },
        {
            key: 'accountType',
            label: 'Account Type',
            width: '150px',
            sortable: true,
            render: (user) => (
                <AccountTypeBadge type={user.customerId ? 'subscription' : 'free'}>
                    {user.customerId ? 'Subscription' : 'Free'}
                </AccountTypeBadge>
            ),
        },
        {
            key: 'userId',
            label: 'User ID',
            width: '300px',
            sortable: true,
            render: (user) => (
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {user.userId}
                </span>
            ),
        },
        {
            key: 'customerId',
            label: 'Customer ID',
            width: '200px',
            sortable: true,
            render: (user) => user.customerId || 'N/A',
        },
        {
            key: 'hasUploadPermission',
            label: 'Upload Permission',
            width: '150px',
            sortable: true,
            render: (user) => (
                <PermissionBadge hasPermission={user.hasUploadPermission}>
                    {user.hasUploadPermission ? 'Approved' : 'Not Approved'}
                </PermissionBadge>
            ),
        },
        {
            key: 'modCount',
            label: 'Mods',
            width: '100px',
            sortable: true,
            render: (user) => user.modCount.toLocaleString(),
        },
        {
            key: 'createdAt',
            label: 'Created',
            width: '120px',
            sortable: true,
            render: (user) => user.createdAt 
                ? new Date(user.createdAt).toLocaleDateString()
                : 'N/A',
        },
        {
            key: 'lastLogin',
            label: 'Last Login',
            width: '120px',
            sortable: true,
            render: (user) => user.lastLogin 
                ? new Date(user.lastLogin).toLocaleDateString()
                : 'Never',
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '300px',
            render: (user) => (
                <ActionGroup>
                    <Button
                        variant={user.hasUploadPermission ? 'danger' : 'primary'}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePermission(user.userId, user.hasUploadPermission);
                        }}
                        disabled={updateUser.isPending}
                    >
                        {user.hasUploadPermission ? 'Revoke Permission' : 'Approve Upload'}
                    </Button>
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to user detail view (could be a modal or separate page)
                            // For now, just log
                            console.log('View user details:', user.userId);
                        }}
                    >
                        View Details
                    </Button>
                </ActionGroup>
            ),
        },
    ], [handleTogglePermission, updateUser]);

    const selectedCount = selectedIds.size;
    const hasSelection = selectedCount > 0;
    
    // Calculate stats
    const totalUsers = data?.users.length || 0;
    const filteredUsersCount = sortedUsers.length;
    const approvedUsers = sortedUsers.filter(u => u.hasUploadPermission).length;
    const totalMods = sortedUsers.reduce((sum, u) => sum + u.modCount, 0);

    // Determine API status
    const apiStatus = isLoading ? 'loading' : error ? 'error' : 'success';
    const apiStatusText = isLoading 
        ? 'Loading users...' 
        : error 
        ? `Error: ${(error as Error).message}` 
        : `Loaded ${totalUsers} user${totalUsers !== 1 ? 's' : ''}`;

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>User Management</Title>
                <ApiStatusBar>
                    <StatusIndicator status={apiStatus}>
                        API Status: {apiStatusText}
                    </StatusIndicator>
                </ApiStatusBar>
                <FiltersSection>
                    <SearchContainer>
                        <AdvancedSearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder='Search users... (use "quotes" for exact, space for AND, | for OR)'
                        />
                    </SearchContainer>
                </FiltersSection>
            </PageHeader>

            <StatsContainer>
                <StatItem>
                    <StatLabel>Total Users</StatLabel>
                    <StatValue>{isLoading ? '...' : totalUsers.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Filtered Results</StatLabel>
                    <StatValue>{isLoading ? '...' : filteredUsersCount.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Approved Uploaders</StatLabel>
                    <StatValue>{isLoading ? '...' : approvedUsers.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Total Mods</StatLabel>
                    <StatValue>{isLoading ? '...' : totalMods.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Selected</StatLabel>
                    <StatValue>{selectedCount.toLocaleString()}</StatValue>
                </StatItem>
            </StatsContainer>

            <Toolbar>
                {hasSelection && (
                    <>
                        <SelectionInfo>{selectedCount} selected</SelectionInfo>
                        <Button
                            variant="primary"
                            onClick={() => {
                                setBulkAction('approve');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateUser.isPending}
                        >
                            Bulk Approve
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => {
                                setBulkAction('revoke');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateUser.isPending}
                        >
                            Bulk Revoke
                        </Button>
                        <Button onClick={() => setSelectedIds(new Set())}>
                            Clear Selection
                        </Button>
                    </>
                )}
            </Toolbar>

            <TableContainer>
                {isLoading ? (
                    <EmptyState>
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}>[?]</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: spacing.xs }}>Loading users...</div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>Fetching data from API</div>
                    </EmptyState>
                ) : error ? (
                    <EmptyState>
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}>[WARNING]</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: spacing.xs, color: colors.danger }}>
                            Failed to load users
                        </div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                            {(error as Error).message || 'An error occurred while fetching users'}
                        </div>
                    </EmptyState>
                ) : sortedUsers.length > 0 ? (
                    <VirtualizedTable
                        data={sortedUsers}
                        columns={columns}
                        height={600}
                        rowHeight={56}
                        getItemId={(user) => user.userId}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        colors={colors}
                    />
                ) : (
                    <EmptyState>
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}>👤</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: spacing.xs }}>
                            {searchQuery.trim() 
                                ? `No users found matching "${searchQuery}"`
                                : 'No users found'
                            }
                        </div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                            {searchQuery.trim() 
                                ? 'Try adjusting your search query'
                                : 'No user data available'
                            }
                        </div>
                    </EmptyState>
                )}
            </TableContainer>

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
                title={bulkAction === 'approve' ? 'Bulk Approve Users' : 'Bulk Revoke Users'}
                message={
                    bulkAction === 'approve'
                        ? `Are you sure you want to approve ${selectedCount} user(s) for upload permissions?`
                        : `Are you sure you want to revoke upload permissions from ${selectedCount} user(s)?`
                }
                confirmText={bulkAction === 'approve' ? 'Approve All' : 'Revoke All'}
                cancelText="Cancel"
                isLoading={updateUser.isPending}
            />
        </PageContainer>
    );
}

