/**
 * Admin Panel
 * Triage interface for mod review and management
 */

import { useState } from 'react';
import { useAdminModsList, useUpdateModStatus } from '../hooks/useMods';
import styled from 'styled-components';
import { colors, spacing } from '../theme/index';
import type { ModStatus } from '../types/mod';

const PageContainer = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Filters = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  flex-wrap: wrap;
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const ModsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: ${colors.bgSecondary};
  border-radius: 8px;
  overflow: hidden;
`;

const TableHeader = styled.thead`
  background: ${colors.bgTertiary};
`;

const TableRow = styled.tr`
  border-bottom: 1px solid ${colors.border};
  
  &:hover {
    background: ${colors.bgTertiary};
  }
`;

const TableHeaderCell = styled.th`
  padding: ${spacing.md};
  text-align: left;
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const TableCell = styled.td`
  padding: ${spacing.md};
  color: ${colors.textSecondary};
  font-size: 0.875rem;
`;

const StatusBadge = styled.span<{ status: ModStatus }>`
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'published': return `${colors.success}20`;
      case 'approved': return `${colors.success}20`;
      case 'pending': return `${colors.warning}20`;
      case 'changes_requested': return `${colors.warning}20`;
      case 'denied': return `${colors.danger}20`;
      case 'draft': return `${colors.bgTertiary}`;
      case 'archived': return `${colors.bgTertiary}`;
      default: return colors.bgTertiary;
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'published': return colors.success;
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'changes_requested': return colors.warning;
      case 'denied': return colors.danger;
      default: return colors.textSecondary;
    }
  }};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: ${spacing.xs} ${spacing.sm};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${props => {
    if (props.variant === 'primary') return colors.accent;
    if (props.variant === 'danger') return colors.danger;
    return colors.bgSecondary;
  }};
  color: ${props => props.variant === 'primary' || props.variant === 'danger' ? '#fff' : colors.text};
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: ${spacing.xs};
`;

const Link = styled.a`
  color: ${colors.accent};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
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

export function AdminPanel() {
    const [statusFilter, setStatusFilter] = useState<string>('pending');
    
    const { data, isLoading, error } = useAdminModsList({
        page: 1,
        pageSize: 100,
        status: statusFilter || undefined,
    });

    const updateStatus = useUpdateModStatus();

    const handleStatusChange = async (modId: string, newStatus: ModStatus, reason?: string) => {
        await updateStatus.mutateAsync({ modId, status: newStatus, reason });
    };

    if (isLoading) return <Loading>Loading mods...</Loading>;
    if (error) return <Error>Failed to load mods: {(error as Error).message}</Error>;

    const mods = data?.mods || [];
    const filteredMods = statusFilter ? mods.filter(m => m.status === statusFilter) : mods;

    return (
        <PageContainer>
            <Header>
                <Title>Admin Panel - Mod Triage</Title>
                <Filters>
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
                </Filters>
            </Header>

            <ModsTable>
                <TableHeader>
                    <TableRow>
                        <TableHeaderCell>Title</TableHeaderCell>
                        <TableHeaderCell>Author</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Category</TableHeaderCell>
                        <TableHeaderCell>Created</TableHeaderCell>
                        <TableHeaderCell>Actions</TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <tbody>
                    {filteredMods.map((mod) => (
                        <TableRow key={mod.modId}>
                            <TableCell>
                                <Link href={`/mods/${mod.slug}`}>{mod.title}</Link>
                            </TableCell>
                            <TableCell>{mod.authorEmail}</TableCell>
                            <TableCell>
                                <StatusBadge status={mod.status}>{mod.status}</StatusBadge>
                            </TableCell>
                            <TableCell>{mod.category}</TableCell>
                            <TableCell>{new Date(mod.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                                <ActionGroup>
                                    <ActionButton
                                        variant="primary"
                                        onClick={() => handleStatusChange(mod.modId, 'approved')}
                                        disabled={updateStatus.isPending || mod.status === 'approved'}
                                    >
                                        Approve
                                    </ActionButton>
                                    <ActionButton
                                        onClick={() => handleStatusChange(mod.modId, 'changes_requested')}
                                        disabled={updateStatus.isPending || mod.status === 'changes_requested'}
                                    >
                                        Request Changes
                                    </ActionButton>
                                    <ActionButton
                                        variant="danger"
                                        onClick={() => handleStatusChange(mod.modId, 'denied')}
                                        disabled={updateStatus.isPending || mod.status === 'denied'}
                                    >
                                        Deny
                                    </ActionButton>
                                    <ActionButton
                                        onClick={() => window.location.href = `/mods/${mod.slug}/review`}
                                    >
                                        Review
                                    </ActionButton>
                                </ActionGroup>
                            </TableCell>
                        </TableRow>
                    ))}
                </tbody>
            </ModsTable>

            {filteredMods.length === 0 && (
                <Loading>No mods found with status: {statusFilter || 'all'}</Loading>
            )}
        </PageContainer>
    );
}

