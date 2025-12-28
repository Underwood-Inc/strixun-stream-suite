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
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AdvancedSearchInput } from '../../../shared-components/search-query-parser/AdvancedSearchInput';
import type { Column } from '../../../shared-components/virtualized-table/VirtualizedTable';
import { VirtualizedTable } from '../../../shared-components/virtualized-table/VirtualizedTable';
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

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${spacing.md};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
`;

const Filters = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  flex-wrap: wrap;
  flex: 1;
  justify-content: flex-end;
`;

const SearchContainer = styled.div`
  min-width: 300px;
  flex: 1;
  max-width: 500px;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
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
    const navigate = useNavigate();
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
    const { filteredUsers, sortedUsers } = useMemo(() => {
        if (isLoading || error || !data) return { filteredUsers: [], sortedUsers: [] };
        
        let users = data.users;
        
        // Filter by search query
        if (searchQuery.trim()) {
            users = filterUsersBySearchQuery(users, searchQuery);
        }
        
        const filtered = users;
        
        // Sort users
        let sorted = [...filtered];
        if (sortConfig) {
            sorted.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof UserListItem];
                const bVal = b[sortConfig.key as keyof UserListItem];
                
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
        
        return { filteredUsers: filtered, sortedUsers: sorted };
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
        } catch (error) {
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

    if (isLoading) return <Loading>Loading users...</Loading>;
    if (error) return <Error>Failed to load users: {(error as Error).message}</Error>;

    const selectedCount = selectedIds.size;
    const hasSelection = selectedCount > 0;
    
    // Calculate stats
    const totalUsers = sortedUsers.length;
    const approvedUsers = sortedUsers.filter(u => u.hasUploadPermission).length;
    const totalMods = sortedUsers.reduce((sum, u) => sum + u.modCount, 0);

    return (
        <PageContainer>
            <Header>
                <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
                    <Title>User Management</Title>
                    <Button
                        onClick={() => navigate('/admin')}
                        variant="secondary"
                    >
                        Mod Triage
                    </Button>
                    <Button
                        onClick={() => navigate('/admin/r2')}
                        variant="secondary"
                    >
                        R2 Management
                    </Button>
                </div>
                <Filters>
                    <SearchContainer>
                        <AdvancedSearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder='Search users... (use "quotes" for exact, space for AND, | for OR)'
                        />
                    </SearchContainer>
                </Filters>
            </Header>

            <StatsContainer>
                <StatItem>
                    <StatLabel>Total Users</StatLabel>
                    <StatValue>{totalUsers.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Approved Uploaders</StatLabel>
                    <StatValue>{approvedUsers.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Total Mods</StatLabel>
                    <StatValue>{totalMods.toLocaleString()}</StatValue>
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
                {sortedUsers.length > 0 ? (
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
                    <Loading>
                        {searchQuery.trim() 
                            ? `No users found matching "${searchQuery}"`
                            : 'No users found'
                        }
                    </Loading>
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

