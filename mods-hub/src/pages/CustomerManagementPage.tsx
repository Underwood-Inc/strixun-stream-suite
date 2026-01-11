/**
 * Customer Management Page - Admin Interface for Managing Customers
 * 
 * This page allows super admins to manage upload permissions for regular customers.
 * 
 * Permission System:
 * - Super Admins: From SUPER_ADMIN_EMAILS env var (hardcoded backup - always have permission)
 * - Approved Uploaders: Managed here via UI (stored in KV, can upload and manage own mods)
 * 
 * Features:
 * - Virtualized table (handles thousands of records)
 * - Sortable columns
 * - Advanced search with human-friendly query parser
 * - Bulk selection and actions
 * - Upload permission management (approve/revoke)
 * - View customer details and mods
 * - Optimized for performance
 * 
 * Access: Super admin only (via AdminRoute protection)
 */

import { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AdvancedSearchInput } from '@strixun/search-query-parser/react';
import { DataTable, type DataTableColumn } from '@strixun/shared-components/react/DataTable';
import { ActionMenu, type ActionMenuItem } from '@strixun/shared-components/react/ActionMenu';
import { InfoModal } from '@strixun/shared-components/react/InfoModal';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { useUpdateCustomer, useCustomersList } from '../hooks/useCustomers';
import { colors, spacing } from '../theme/index';
import type { CustomerListItem } from '../types/customer';
import { formatDate } from '@strixun/shared-config/date-utils';
import { filterCustomersBySearchQuery } from '../utils/searchCustomers';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles } from '../utils/sharedStyles';

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

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  font-size: 0.75rem;
  white-space: nowrap;
`;

const PermissionBadge = styled.span<{ hasPermission: boolean; source?: 'super-admin' | 'env-var' | 'kv' }>`
  ${({ hasPermission, source }) => {
    if (!hasPermission) return getBadgeStyles('default');
    if (source === 'super-admin') return getBadgeStyles('accent');
    if (source === 'env-var') return getBadgeStyles('info');
    return getBadgeStyles('success'); // KV-based
  }}
`;

const AccountTypeBadge = styled.span<{ type: 'free' | 'subscription' }>`
  ${({ type }) => getBadgeStyles(type === 'subscription' ? 'accent' : 'default')}
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

export function CustomerManagementPage() {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<'approve' | 'revoke' | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<CustomerListItem | null>(null);
    
    const { data, isLoading, error } = useCustomersList({
        page: 1,
        pageSize: 1000, // Load more for admin panel
    });

    const updateCustomer = useUpdateCustomer();

    // Filter and sort customers - MEMOIZED for performance
    const sortedCustomers = useMemo(() => {
        if (isLoading || error || !data) return [];
        
        let customers = data.customers;
        
        // Filter by search query
        if (searchQuery.trim()) {
            customers = filterCustomersBySearchQuery(customers, searchQuery);
        }
        
        // Sorting is now handled by TanStack Table internally
        return customers;
    }, [data, searchQuery, isLoading, error]);

    // Handle permission toggle
    const handleTogglePermission = useCallback(async (customerId: string, hasPermission: boolean) => {
        await updateCustomer.mutateAsync({
            customerId,
            updates: { hasUploadPermission: !hasPermission },
        });
    }, [updateCustomer]);

    // Bulk actions
    const handleBulkAction = useCallback(async (action: 'approve' | 'revoke') => {
        if (selectedIds.size === 0) return;
        
        // Filter to only customers whose permissions can be managed via UI (KV-based or none)
        // Skip super admins and env-var approved uploaders (they're hardcoded)
        const customersToUpdate = sortedCustomers.filter(customer => 
            selectedIds.has(customer.customerId) && 
            (customer.permissionSource === 'kv' || customer.permissionSource === 'none')
        );
        
        if (customersToUpdate.length === 0) {
            // All selected customers have env-based permissions that can't be managed via UI
            return;
        }
        
        try {
            for (const customer of customersToUpdate) {
                await updateCustomer.mutateAsync({
                    customerId: customer.customerId,
                    updates: { hasUploadPermission: action === 'approve' },
                });
            }
            setSelectedIds(new Set());
            setBulkActionModalOpen(false);
        } catch {
            // Error handled by mutations
        }
    }, [selectedIds, sortedCustomers, updateCustomer]);

    // Table columns definition
    const columns: DataTableColumn<CustomerListItem>[] = useMemo(() => [
        {
            id: 'displayName',
            accessorKey: 'displayName',
            header: 'Display Name',
            size: 250,
            enableSorting: true,
            cell: ({ row }) => row.displayName || 'Unknown Customer',
        },
        {
            id: 'accountType',
            header: 'Account Type',
            size: 150,
            enableSorting: true,
            cell: ({ row }) => (
                <AccountTypeBadge type={row.customerIdExternal ? 'subscription' : 'free'}>
                    {row.customerIdExternal ? 'Subscription' : 'Free'}
                </AccountTypeBadge>
            ),
        },
        {
            id: 'customerId',
            accessorKey: 'customerId',
            header: 'Customer ID',
            size: 300,
            enableSorting: true,
            cell: ({ row }) => (
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {row.customerId}
                </span>
            ),
        },
        {
            id: 'customerIdExternal',
            accessorKey: 'customerIdExternal',
            header: 'External ID',
            size: 200,
            enableSorting: true,
            cell: ({ row }) => row.customerIdExternal || 'N/A',
        },
        {
            id: 'hasUploadPermission',
            accessorKey: 'hasUploadPermission',
            header: 'Upload Permission',
            size: 200,
            enableSorting: true,
            cell: ({ row }) => {
                if (!row.hasUploadPermission) {
                    return (
                        <PermissionBadge hasPermission={false}>
                            Not Approved
                        </PermissionBadge>
                    );
                }
                
                // Show permission source
                const sourceLabel = row.permissionSource === 'super-admin' 
                    ? 'Super Admin' 
                    : row.permissionSource === 'env-var'
                    ? 'Env Var'
                    : row.permissionSource === 'kv'
                    ? 'KV Approved'
                    : 'Approved';
                
                return (
                    <PermissionBadge hasPermission={true} source={row.permissionSource === 'none' ? undefined : row.permissionSource}>
                        {sourceLabel}
                    </PermissionBadge>
                );
            },
        },
        {
            id: 'modCount',
            accessorKey: 'modCount',
            header: 'Mods',
            size: 100,
            enableSorting: true,
            cell: ({ row }) => row.modCount.toLocaleString(),
        },
        {
            id: 'createdAt',
            accessorKey: 'createdAt',
            header: 'Created',
            size: 120,
            enableSorting: true,
            cell: ({ row }) => row.createdAt 
                ? formatDate(row.createdAt)
                : 'N/A',
        },
        {
            id: 'lastLogin',
            accessorKey: 'lastLogin',
            header: 'Last Login',
            size: 120,
            enableSorting: true,
            cell: ({ row }) => row.lastLogin 
                ? formatDate(row.lastLogin)
                : 'Never',
        },
        {
            id: 'actions',
            header: 'Actions',
            size: 80,
            cell: ({ row }) => {
                // Can't revoke permissions from env var or super admin (they're hardcoded)
                const canManagePermission = row.permissionSource === 'kv' || row.permissionSource === 'none';
                
                const menuItems: ActionMenuItem[] = [
                    {
                        key: 'view',
                        label: 'View Details',
                        icon: '👁',
                        onClick: () => {
                            setViewingCustomer(row);
                        },
                    },
                    {
                        key: 'permission',
                        label: canManagePermission 
                            ? (row.hasUploadPermission ? 'Revoke Permission' : 'Approve Upload')
                            : (row.hasUploadPermission ? 'Env Managed' : 'No Permission'),
                        icon: canManagePermission ? (row.hasUploadPermission ? '🚫' : '✓') : '🔒',
                        onClick: () => {
                            if (canManagePermission) {
                                handleTogglePermission(row.customerId, row.hasUploadPermission);
                            }
                        },
                        disabled: !canManagePermission || updateCustomer.isPending,
                        variant: canManagePermission && row.hasUploadPermission ? 'danger' : 'primary',
                    },
                    {
                        key: 'export',
                        label: 'Export Data (GDPR)',
                        icon: '📥',
                        onClick: () => {
                            console.log('Export customer data:', row.customerId);
                        },
                    },
                ];
                
                return <ActionMenu items={menuItems} />;
            },
        },
    ], [handleTogglePermission, updateCustomer, setViewingCustomer]);

    const selectedCount = selectedIds.size;
    const hasSelection = selectedCount > 0;
    
    // Calculate stats
    const totalCustomers = data?.customers.length || 0;
    const filteredCustomersCount = sortedCustomers.length;
    const approvedCustomers = sortedCustomers.filter(c => c.hasUploadPermission).length;
    const totalMods = sortedCustomers.reduce((sum, c) => sum + c.modCount, 0);

    // Determine API status
    const apiStatus = isLoading ? 'loading' : error ? 'error' : 'success';
    const apiStatusText = isLoading 
        ? 'Loading customers...' 
        : error 
        ? `Error: ${(error as Error).message}` 
        : `Loaded ${totalCustomers} customer${totalCustomers !== 1 ? 's' : ''}`;

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>Customer Management</Title>
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
                            placeholder='Search customers... (use "quotes" for exact, space for AND, | for OR)'
                        />
                    </SearchContainer>
                </FiltersSection>
            </PageHeader>

            <StatsContainer>
                <StatItem>
                    <StatLabel>Total Customers</StatLabel>
                    <StatValue>{isLoading ? '...' : totalCustomers.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Filtered Results</StatLabel>
                    <StatValue>{isLoading ? '...' : filteredCustomersCount.toLocaleString()}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Approved Uploaders</StatLabel>
                    <StatValue>{isLoading ? '...' : approvedCustomers.toLocaleString()}</StatValue>
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
                            $variant="primary"
                            onClick={() => {
                                setBulkAction('approve');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateCustomer.isPending}
                        >
                            Bulk Approve
                        </Button>
                        <Button
                            $variant="danger"
                            onClick={() => {
                                setBulkAction('revoke');
                                setBulkActionModalOpen(true);
                            }}
                            disabled={updateCustomer.isPending}
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
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}>⏳</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: spacing.xs }}>Loading customers...</div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>Fetching data from API</div>
                    </EmptyState>
                ) : error ? (
                    <EmptyState>
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}>⚠</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: spacing.xs, color: colors.danger }}>
                            Failed to load customers
                        </div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                            {(error as Error).message || 'An error occurred while fetching customers'}
                        </div>
                    </EmptyState>
                ) : sortedCustomers.length > 0 ? (
                    <DataTable
                        data={sortedCustomers}
                        columns={columns}
                        rowHeight={56}
                        getRowId={(customer) => customer.customerId}
                        enableSorting={true}
                        enableSelection={true}
                        enableVirtualization={true}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        emptyMessage="No customers found matching your search criteria"
                        colors={colors}
                    />
                ) : (
                    <EmptyState>
                        <div style={{ fontSize: '1.5rem', marginBottom: spacing.md }}> ★ </div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: spacing.xs }}>
                            {searchQuery.trim() 
                                ? `No customers found matching "${searchQuery}"`
                                : 'No customers found'
                            }
                        </div>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                            {searchQuery.trim() 
                                ? 'Try adjusting your search query'
                                : 'No customer data available'
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
                title={bulkAction === 'approve' ? 'Bulk Approve Customers' : 'Bulk Revoke Customers'}
                message={
                    (() => {
                        const envManagedCount = sortedCustomers.filter(c => 
                            selectedIds.has(c.customerId) && 
                            (c.permissionSource === 'env-var' || c.permissionSource === 'super-admin')
                        ).length;
                        const manageableCount = selectedCount - envManagedCount;
                        
                        let baseMessage = bulkAction === 'approve'
                            ? `Are you sure you want to approve ${manageableCount} customer(s) for upload permissions?`
                            : `Are you sure you want to revoke upload permissions from ${manageableCount} customer(s)?`;
                        
                        if (envManagedCount > 0) {
                            baseMessage += `\n\nNote: ${envManagedCount} selected customer(s) have permissions set via environment variables and cannot be modified via the UI.`;
                        }
                        
                        return baseMessage;
                    })()
                }
                confirmText={bulkAction === 'approve' ? 'Approve All' : 'Revoke All'}
                cancelText="Cancel"
                isLoading={updateCustomer.isPending}
            />
            
            {viewingCustomer && (
                <InfoModal
                    isOpen={true}
                    onClose={() => setViewingCustomer(null)}
                    title={`Customer Details: ${viewingCustomer.displayName || 'N/A'}`}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ margin: 0 }}><strong>Customer ID:</strong> {viewingCustomer.customerId}</p>
                        <p style={{ margin: 0 }}><strong>External ID:</strong> {viewingCustomer.customerIdExternal || 'N/A'}</p>
                        <p style={{ margin: 0 }}><strong>Display Name:</strong> {viewingCustomer.displayName || 'N/A'}</p>
                        <p style={{ margin: 0 }}><strong>Account Type:</strong> {viewingCustomer.customerIdExternal ? 'Subscription' : 'Free'}</p>
                        <p style={{ margin: 0 }}><strong>Upload Permission:</strong> {viewingCustomer.hasUploadPermission ? 'Yes' : 'No'}</p>
                        {viewingCustomer.hasUploadPermission && (
                            <p style={{ margin: 0 }}><strong>Permission Source:</strong> {viewingCustomer.permissionSource}</p>
                        )}
                        <p style={{ margin: 0 }}><strong>Total Mods:</strong> {viewingCustomer.modCount}</p>
                        <p style={{ margin: 0 }}><strong>Created:</strong> {viewingCustomer.createdAt ? formatDate(viewingCustomer.createdAt) : 'N/A'}</p>
                        <p style={{ margin: 0 }}><strong>Last Login:</strong> {viewingCustomer.lastLogin ? formatDate(viewingCustomer.lastLogin) : 'Never'}</p>
                    </div>
                </InfoModal>
            )}
        </PageContainer>
    );
}

