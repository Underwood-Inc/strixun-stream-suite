/**
 * R2 Management Page
 * Admin-only page for managing R2 storage, detecting duplicates, and cleaning up orphaned files
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { listR2Files, detectDuplicates, deleteR2File, bulkDeleteR2Files } from '../services/api';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

const PageContainer = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: ${spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const PageHeader = styled.div`
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

const Tabs = styled.div`
  display: flex;
  gap: ${spacing.sm};
  border-bottom: 2px solid ${colors.border};
  margin-bottom: ${spacing.lg};
`;

const Tab = styled.button<{ active: boolean }>`
  padding: ${spacing.sm} ${spacing.md};
  background: none;
  border: none;
  border-bottom: 2px solid ${props => props.active ? colors.accent : 'transparent'};
  color: ${props => props.active ? colors.accent : colors.textSecondary};
  font-size: 0.875rem;
  font-weight: ${props => props.active ? 600 : 400};
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: -2px;

  &:hover {
    color: ${colors.accent};
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' | 'secondary' }>`
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${props => {
    if (props.variant === 'primary') return colors.accent;
    if (props.variant === 'danger') return colors.danger;
    return colors.bgSecondary;
  }};
  color: ${props => props.variant === 'primary' || props.variant === 'danger' ? '#fff' : colors.text};
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SummaryCard = styled.div`
  padding: ${spacing.lg};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${spacing.md};
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const SummaryLabel = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SummaryValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.text};
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  max-height: 600px;
  overflow-y: auto;
`;

const FileItem = styled.div`
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const FileInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  min-width: 0;
`;

const FileKey = styled.div`
  font-family: monospace;
  font-size: 0.875rem;
  color: ${colors.text};
  word-break: break-all;
`;

const FileMeta = styled.div`
  display: flex;
  gap: ${spacing.md};
  font-size: 0.75rem;
  color: ${colors.textSecondary};
`;

const Badge = styled.span<{ variant?: 'danger' | 'warning' | 'info' }>`
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    if (props.variant === 'danger') return `${colors.danger}20`;
    if (props.variant === 'warning') return `${colors.warning}20`;
    return `${colors.accent}20`;
  }};
  color: ${props => {
    if (props.variant === 'danger') return colors.danger;
    if (props.variant === 'warning') return colors.warning;
    return colors.accent;
  }};
`;

const DuplicateGroupCard = styled.div`
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  margin-bottom: ${spacing.md};
`;

const DuplicateGroupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.md};
`;

const DuplicateGroupTitle = styled.div`
  font-weight: 600;
  color: ${colors.text};
`;

const DuplicateGroupFiles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
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

const EmptyState = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

const Checkbox = styled.input`
  margin-right: ${spacing.sm};
`;

const SelectionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  margin-bottom: ${spacing.md};
`;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

type TabType = 'files' | 'duplicates' | 'orphaned';

export function R2ManagementPage() {
    const [activeTab, setActiveTab] = useState<TabType>('duplicates');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Fetch duplicates/orphaned files
    const { data: duplicatesData, isLoading: isLoadingDuplicates, error: duplicatesError, refetch: refetchDuplicates } = useQuery({
        queryKey: ['r2-duplicates'],
        queryFn: detectDuplicates,
        enabled: activeTab === 'duplicates' || activeTab === 'orphaned',
    });

    // Fetch all files (for files tab)
    const { data: filesData, isLoading: isLoadingFiles, error: filesError } = useQuery({
        queryKey: ['r2-files'],
        queryFn: () => listR2Files({ limit: 1000 }),
        enabled: activeTab === 'files',
    });

    // Delete file mutation
    const deleteFileMutation = useMutation({
        mutationFn: deleteR2File,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['r2-duplicates'] });
            queryClient.invalidateQueries({ queryKey: ['r2-files'] });
            setDeleteModalOpen(false);
            setFileToDelete(null);
        },
    });

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: bulkDeleteR2Files,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['r2-duplicates'] });
            queryClient.invalidateQueries({ queryKey: ['r2-files'] });
            setSelectedFiles(new Set());
        },
    });

    const handleDeleteClick = useCallback((key: string) => {
        setFileToDelete(key);
        setDeleteModalOpen(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!fileToDelete) return;
        await deleteFileMutation.mutateAsync(fileToDelete);
    }, [fileToDelete, deleteFileMutation]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        await bulkDeleteMutation.mutateAsync(Array.from(selectedFiles));
    }, [selectedFiles, bulkDeleteMutation]);

    const toggleFileSelection = useCallback((key: string) => {
        setSelectedFiles(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const renderOrphanedFiles = () => {
        if (isLoadingDuplicates) return <Loading>Scanning for orphaned files...</Loading>;
        if (duplicatesError) return <Error>Failed to scan: {(duplicatesError as Error).message}</Error>;
        if (!duplicatesData) return null;

        const orphaned = duplicatesData.orphanedFiles;

        if (orphaned.length === 0) {
            return <EmptyState>No orphaned files found. All files are referenced in KV.</EmptyState>;
        }

        return (
            <>
                <SelectionBar>
                    <div>
                        {selectedFiles.size > 0 && (
                            <span>{selectedFiles.size} file(s) selected</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button
                            variant="danger"
                            onClick={handleBulkDelete}
                            disabled={selectedFiles.size === 0 || bulkDeleteMutation.isPending}
                        >
                            Delete Selected ({selectedFiles.size})
                        </Button>
                        <Button onClick={() => setSelectedFiles(new Set())}>
                            Clear Selection
                        </Button>
                    </div>
                </SelectionBar>
                <FileList>
                    {orphaned.map((file) => (
                        <FileItem key={file.key}>
                            <Checkbox
                                type="checkbox"
                                checked={selectedFiles.has(file.key)}
                                onChange={() => toggleFileSelection(file.key)}
                            />
                            <FileInfo>
                                <FileKey>{file.key}</FileKey>
                                <FileMeta>
                                    <span>{formatBytes(file.size)}</span>
                                    <span>{new Date(file.uploaded).toLocaleDateString()}</span>
                                    {file.contentType && <span>{file.contentType}</span>}
                                </FileMeta>
                            </FileInfo>
                            <Badge variant="danger">Orphaned</Badge>
                            <Button
                                variant="danger"
                                onClick={() => handleDeleteClick(file.key)}
                                disabled={deleteFileMutation.isPending}
                            >
                                Delete
                            </Button>
                        </FileItem>
                    ))}
                </FileList>
            </>
        );
    };

    const renderDuplicates = () => {
        if (isLoadingDuplicates) return <Loading>Scanning for duplicates...</Loading>;
        if (duplicatesError) return <Error>Failed to scan: {(duplicatesError as Error).message}</Error>;
        if (!duplicatesData) return null;

        const groups = duplicatesData.duplicateGroups;

        if (groups.length === 0) {
            return <EmptyState>No duplicate files found.</EmptyState>;
        }

        return (
            <div>
                {groups.map((group, index) => (
                    <DuplicateGroupCard key={index}>
                        <DuplicateGroupHeader>
                            <DuplicateGroupTitle>
                                {group.count} duplicate file(s) - {formatBytes(group.totalSize)} total
                            </DuplicateGroupTitle>
                            <Badge variant="warning">
                                Wasted: {formatBytes(group.totalSize - (group.files[0]?.size || 0))}
                            </Badge>
                        </DuplicateGroupHeader>
                        <DuplicateGroupFiles>
                            {group.files.map((file: { key: string; size: number; uploaded: Date; contentType?: string; customMetadata?: Record<string, string> }) => (
                                <FileItem key={file.key}>
                                    <FileInfo>
                                        <FileKey>{file.key}</FileKey>
                                        <FileMeta>
                                            <span>{formatBytes(file.size)}</span>
                                            <span>{new Date(file.uploaded).toLocaleDateString()}</span>
                                        </FileMeta>
                                    </FileInfo>
                                    {file.key === group.recommendedKeep && (
                                        <Badge variant="info">Keep</Badge>
                                    )}
                                    <Button
                                        variant="danger"
                                        onClick={() => handleDeleteClick(file.key)}
                                        disabled={deleteFileMutation.isPending || file.key === group.recommendedKeep}
                                    >
                                        Delete
                                    </Button>
                                </FileItem>
                            ))}
                        </DuplicateGroupFiles>
                    </DuplicateGroupCard>
                ))}
            </div>
        );
    };

    const renderFiles = () => {
        if (isLoadingFiles) return <Loading>Loading files...</Loading>;
        if (filesError) return <Error>Failed to load files: {(filesError as Error).message}</Error>;
        if (!filesData) return null;

        if (filesData.files.length === 0) {
            return <EmptyState>No files found.</EmptyState>;
        }

        return (
            <FileList>
                {filesData.files.map((file) => (
                    <FileItem key={file.key}>
                        <FileInfo>
                            <FileKey>{file.key}</FileKey>
                            <FileMeta>
                                <span>{formatBytes(file.size)}</span>
                                <span>{new Date(file.uploaded).toLocaleDateString()}</span>
                                {file.contentType && <span>{file.contentType}</span>}
                            </FileMeta>
                        </FileInfo>
                        <Button
                            variant="danger"
                            onClick={() => handleDeleteClick(file.key)}
                            disabled={deleteFileMutation.isPending}
                        >
                            Delete
                        </Button>
                    </FileItem>
                ))}
            </FileList>
        );
    };

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>R2 Management</Title>
                <Button
                    variant="primary"
                    onClick={() => refetchDuplicates()}
                    disabled={isLoadingDuplicates}
                >
                    Refresh Scan
                </Button>
            </PageHeader>

            {duplicatesData && (
                <SummaryCard>
                    <SummaryItem>
                        <SummaryLabel>Total Files</SummaryLabel>
                        <SummaryValue>{duplicatesData.summary.totalFiles.toLocaleString()}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>Referenced Files</SummaryLabel>
                        <SummaryValue>{duplicatesData.summary.referencedFiles.toLocaleString()}</SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>Orphaned Files</SummaryLabel>
                        <SummaryValue style={{ color: colors.danger }}>
                            {duplicatesData.summary.orphanedFiles.toLocaleString()}
                        </SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>Orphaned Size</SummaryLabel>
                        <SummaryValue style={{ color: colors.danger }}>
                            {formatBytes(duplicatesData.summary.orphanedSize)}
                        </SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>Duplicate Groups</SummaryLabel>
                        <SummaryValue style={{ color: colors.warning }}>
                            {duplicatesData.summary.duplicateGroups.toLocaleString()}
                        </SummaryValue>
                    </SummaryItem>
                    <SummaryItem>
                        <SummaryLabel>Wasted Space</SummaryLabel>
                        <SummaryValue style={{ color: colors.warning }}>
                            {formatBytes(duplicatesData.summary.duplicateWastedSize)}
                        </SummaryValue>
                    </SummaryItem>
                </SummaryCard>
            )}

            <Tabs>
                <Tab active={activeTab === 'duplicates'} onClick={() => setActiveTab('duplicates')}>
                    Duplicates
                </Tab>
                <Tab active={activeTab === 'orphaned'} onClick={() => setActiveTab('orphaned')}>
                    Orphaned Files
                </Tab>
                <Tab active={activeTab === 'files'} onClick={() => setActiveTab('files')}>
                    All Files
                </Tab>
            </Tabs>

            {activeTab === 'duplicates' && renderDuplicates()}
            {activeTab === 'orphaned' && renderOrphanedFiles()}
            {activeTab === 'files' && renderFiles()}

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setFileToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="Delete R2 File"
                message={`Are you sure you want to delete "${fileToDelete}"? This action cannot be undone.`}
                confirmText="Delete File"
                cancelText="Cancel"
                isLoading={deleteFileMutation.isPending}
            />
        </PageContainer>
    );
}

