/**
 * R2 Management Page
 * Admin-only page for managing R2 storage, detecting duplicates, and cleaning up orphaned files
 * 
 * Enhanced with:
 * - Human-readable mod/version/customer/user information
 * - Bulk selection and operations on all tabs
 * - Filtering and sorting capabilities
 * - Clickable links to mod detail pages
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { AdminNavigation } from '../components/admin/AdminNavigation';
import { listR2Files, detectDuplicates, deleteR2File, bulkDeleteR2Files, type R2FileInfo } from '../services/api';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles, getCardStyles, type BadgeType } from '../utils/sharedStyles';
import { API_BASE_URL } from '../services/api';

const PageContainer = styled.div`
  max-width: 1800px;
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

const Tab = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>`
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

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  font-size: 0.875rem;
`;

const SummaryCard = styled.div`
  ${getCardStyles('default')}
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

const ControlsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  margin-bottom: ${spacing.md};
`;

const SearchInput = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${colors.bg};
  color: ${colors.text};
  font-size: 0.875rem;
  min-width: 250px;

  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
`;

const Select = styled.select`
  padding: ${spacing.sm} ${spacing.md};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  background: ${colors.bg};
  color: ${colors.text};
  font-size: 0.875rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: ${colors.accent};
  }
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

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  max-height: 800px;
  overflow-y: auto;
`;

const FileItem = styled.div`
  padding: ${spacing.md};
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  gap: ${spacing.md};
  align-items: start;
  transition: background 0.2s ease;

  &:hover {
    background: ${colors.bgTertiary};
  }
`;

const ThumbnailPreview = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid ${colors.border};
  background: ${colors.bgTertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ThumbnailImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ThumbnailPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.textSecondary};
  font-size: 0.75rem;
  text-align: center;
  padding: ${spacing.xs};
`;

const FileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  min-width: 0;
`;

const FileKey = styled.div`
  font-family: monospace;
  font-size: 0.7rem;
  color: ${colors.textSecondary};
  word-break: break-all;
  opacity: 0.7;
  margin-top: ${spacing.xs};
`;

const FileTitle = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: ${colors.text};
  margin-bottom: ${spacing.xs};
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const ModNameLink = styled(Link)`
  color: ${colors.accent};
  text-decoration: none;
  font-weight: 700;
  font-size: 1.25rem;

  &:hover {
    text-decoration: underline;
  }
`;

const FileDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.md};
  font-size: 0.875rem;
  color: ${colors.textSecondary};
  margin-top: ${spacing.xs};
`;

const FileDetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const FileDetailLabel = styled.span`
  font-weight: 600;
  color: ${colors.text};
`;

const CustomerLink = styled.span`
  color: ${colors.text};
  font-weight: 500;
`;

const FileMeta = styled.div`
  display: flex;
  gap: ${spacing.md};
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  margin-top: ${spacing.xs};
`;

const ModFileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
  padding: ${spacing.sm};
  background: ${colors.bgTertiary};
  border-radius: 4px;
  border-left: 3px solid ${colors.accent};
`;

const Badge = styled.span<{ $variant?: 'danger' | 'warning' | 'info' | 'success' }>`
  ${({ $variant = 'default' }) => {
    const badgeType: BadgeType = $variant === 'danger' ? 'danger' : $variant === 'warning' ? 'warning' : $variant === 'info' ? 'info' : $variant === 'success' ? 'accent' : 'accent';
    return getBadgeStyles(badgeType);
  }}
`;

const DuplicateGroupCard = styled.div`
  ${getCardStyles('default')}
  margin-bottom: ${spacing.md};
`;

const DuplicateGroupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.md};
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const DuplicateGroupTitle = styled.div`
  font-weight: 600;
  color: ${colors.text};
  font-size: 1rem;
`;

const DuplicateGroupFiles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const Checkbox = styled.input`
  margin-top: ${spacing.xs};
  cursor: pointer;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const extractCustomerId = (key: string): string | null => {
  const match = key.match(/^customer_([^/]+)\//);
  return match ? match[1] : null;
};

type TabType = 'files' | 'duplicates' | 'orphaned';
type SortField = 'uploaded' | 'size' | 'mod' | 'customer';
type SortDirection = 'asc' | 'desc';

export function R2ManagementPage() {
    const [activeTab, setActiveTab] = useState<TabType>('duplicates');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [protectedFileModalOpen, setProtectedFileModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const [protectedFileInfo, setProtectedFileInfo] = useState<{ key: string; reason?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('uploaded');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [filterType, setFilterType] = useState<'all' | 'thumbnails' | 'mods' | 'orphaned'>('all');
    const queryClient = useQueryClient();

    // Fetch duplicates/orphaned files
    const { data: duplicatesData, isLoading: isLoadingDuplicates, error: duplicatesError, refetch: refetchDuplicates } = useQuery({
        queryKey: ['r2-duplicates'],
        queryFn: detectDuplicates,
        enabled: activeTab === 'duplicates' || activeTab === 'orphaned',
    });

    // Fetch all files (for files tab)
    const { data: filesData, isLoading: isLoadingFiles, error: filesError, refetch: refetchFiles } = useQuery({
        queryKey: ['r2-files'],
        queryFn: () => listR2Files({ limit: 10000 }),
        enabled: activeTab === 'files',
    });

    // Delete file mutation
    const deleteFileMutation = useMutation({
        mutationFn: ({ key, force }: { key: string; force?: boolean }) => deleteR2File(key, force),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['r2-duplicates'] });
            queryClient.invalidateQueries({ queryKey: ['r2-files'] });
            setDeleteModalOpen(false);
            setProtectedFileModalOpen(false);
            setFileToDelete(null);
            setProtectedFileInfo(null);
        },
    });

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation<
        { deleted: number; failed: number; protected?: number; results?: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean }> },
        Error,
        { keys: string[]; force?: boolean }
    >({
        mutationFn: ({ keys, force }) => bulkDeleteR2Files(keys, force),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['r2-duplicates'] });
            queryClient.invalidateQueries({ queryKey: ['r2-files'] });
            setSelectedFiles(new Set());
            setProtectedFileModalOpen(false);
            setProtectedFileInfo(null);
        },
    });

    const handleDeleteClick = useCallback((key: string) => {
        // Check if file is protected by looking it up in the files list
        const allFiles = activeTab === 'files' ? filesData?.files || [] : 
                        activeTab === 'duplicates' ? duplicatesData?.duplicateGroups.flatMap(g => g.files) || [] :
                        duplicatesData?.orphanedFiles || [];
        const file = allFiles.find(f => f.key === key);
        const associated = file?.associatedData;
        const isThumbnail = associated?.isThumbnail;
        const isProtected = isThumbnail && associated?.mod !== undefined;
        
        setFileToDelete(key);
        
        if (isProtected && associated?.mod) {
            setProtectedFileInfo({
                key,
                reason: `This thumbnail is associated with mod "${associated.mod.title}" (${associated.mod.modId})`
            });
            setProtectedFileModalOpen(true);
        } else {
            setDeleteModalOpen(true);
        }
    }, [activeTab, filesData, duplicatesData]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!fileToDelete) return;
        await deleteFileMutation.mutateAsync({ key: fileToDelete, force: false });
    }, [fileToDelete, deleteFileMutation]);

    const handleProtectedFileConfirm = useCallback(async () => {
        if (!fileToDelete) return;
        
        // Check if this is a bulk delete (comma-separated keys) or single delete
        if (fileToDelete.includes(',')) {
            const keys = fileToDelete.split(',').map(k => k.trim());
            await bulkDeleteMutation.mutateAsync({ keys, force: true });
        } else {
            await deleteFileMutation.mutateAsync({ key: fileToDelete, force: true });
        }
    }, [fileToDelete, deleteFileMutation, bulkDeleteMutation]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        
        // Get all files to check for protected ones
        const allFiles = activeTab === 'files' ? filesData?.files || [] : 
                        activeTab === 'duplicates' ? duplicatesData?.duplicateGroups.flatMap(g => g.files) || [] :
                        duplicatesData?.orphanedFiles || [];
        
        // Check for protected files
        const protectedFiles: Array<{ key: string; reason?: string }> = [];
        const filesToDelete = Array.from(selectedFiles);
        
        for (const key of filesToDelete) {
            const file = allFiles.find(f => f.key === key);
            const associated = file?.associatedData;
            const isThumbnail = associated?.isThumbnail;
            const isProtected = isThumbnail && associated?.mod !== undefined;
            
            if (isProtected && associated?.mod) {
                protectedFiles.push({
                    key,
                    reason: `Thumbnail is associated with mod "${associated.mod.title}" (${associated.mod.modId})`
                });
            }
        }
        
        // If there are protected files, show confirmation modal
        if (protectedFiles.length > 0) {
            setProtectedFileInfo({
                key: protectedFiles.map(f => f.key).join(','),
                reason: protectedFiles.length === 1 
                    ? protectedFiles[0].reason
                    : `${protectedFiles.length} files are protected and associated with mods`
            });
            setProtectedFileModalOpen(true);
            setFileToDelete(protectedFiles.map(f => f.key).join(','));
            return;
        }
        
        // For duplicates tab, ensure we don't delete recommended keep files
        let filteredFilesToDelete = filesToDelete;
        if (activeTab === 'duplicates' && duplicatesData) {
            const recommendedKeeps = new Set(
                duplicatesData.duplicateGroups
                    .map(g => g.recommendedKeep)
                    .filter((key): key is string => !!key)
            );
            filteredFilesToDelete = filteredFilesToDelete.filter(key => !recommendedKeeps.has(key));
            
            if (filteredFilesToDelete.length < selectedFiles.size) {
                const removed = selectedFiles.size - filteredFilesToDelete.length;
                const confirmed = window.confirm(
                    `${removed} file(s) are recommended to keep and cannot be deleted. ` +
                    `Delete the remaining ${filteredFilesToDelete.length} duplicate file(s)? This action cannot be undone.`
                );
                if (!confirmed) return;
            } else {
                const confirmed = window.confirm(`Are you sure you want to delete ${filteredFilesToDelete.length} duplicate file(s)? This action cannot be undone.`);
                if (!confirmed) return;
            }
        } else {
            const confirmed = window.confirm(`Are you sure you want to delete ${filteredFilesToDelete.length} file(s)? This action cannot be undone.`);
            if (!confirmed) return;
        }
        
        if (filteredFilesToDelete.length === 0) {
            alert('No files to delete. Recommended keep files cannot be deleted.');
            return;
        }
        
        try {
            const result = await bulkDeleteMutation.mutateAsync({ keys: filteredFilesToDelete, force: false });
            
            // Show warning if any files were protected
            if (result.protected && result.protected > 0) {
                alert(
                    `${result.protected} file(s) were protected and could not be deleted (thumbnails associated with existing mods). ` +
                    `${result.deleted} file(s) were successfully deleted.`
                );
            } else if (result.failed && result.failed > 0) {
                alert(
                    `${result.deleted} file(s) deleted successfully. ` +
                    `${result.failed} file(s) failed to delete.`
                );
            }
        } catch (error: any) {
            // Error handling is done by the mutation
            console.error('Bulk delete error:', error);
        }
    }, [selectedFiles, bulkDeleteMutation, activeTab, duplicatesData]);

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

    const toggleSelectAll = useCallback((files: R2FileInfo[]) => {
        if (files.length === 0) return;
        
        // Check if all files in the current filtered list are selected
        const allFilteredSelected = files.every(file => selectedFiles.has(file.key));
        
        if (allFilteredSelected) {
            // Deselect all filtered files
            setSelectedFiles(prev => {
                const next = new Set(prev);
                files.forEach(file => next.delete(file.key));
                return next;
            });
        } else {
            // Select all filtered files
            setSelectedFiles(prev => {
                const next = new Set(prev);
                files.forEach(file => next.add(file.key));
                return next;
            });
        }
    }, [selectedFiles]);

    // Get all files for current tab
    const getAllFiles = useCallback((): R2FileInfo[] => {
        if (activeTab === 'files' && filesData) {
            return filesData.files;
        }
        if (activeTab === 'orphaned' && duplicatesData) {
            return duplicatesData.orphanedFiles;
        }
        if (activeTab === 'duplicates' && duplicatesData) {
            // For duplicates tab, only return duplicate files (exclude recommended keep files)
            return duplicatesData.duplicateGroups.flatMap(g => 
                g.files.filter(f => f.key !== g.recommendedKeep)
            );
        }
        return [];
    }, [activeTab, filesData, duplicatesData]);

    // Filter and sort files
    const filteredAndSortedFiles = useMemo(() => {
        const allFiles = getAllFiles();
        
        // Filter by search query
        let filtered = allFiles.filter(file => {
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            const key = file.key.toLowerCase();
            const modTitle = file.associatedData?.mod?.title?.toLowerCase() || '';
            const modAuthor = file.associatedData?.mod?.authorDisplayName?.toLowerCase() || '';
            const customerId = extractCustomerId(file.key)?.toLowerCase() || '';
            const version = file.associatedData?.version?.version?.toLowerCase() || '';
            
            return key.includes(query) || 
                   modTitle.includes(query) || 
                   modAuthor.includes(query) || 
                   customerId.includes(query) ||
                   version.includes(query);
        });

        // Filter by type
        if (filterType === 'thumbnails') {
            filtered = filtered.filter(f => f.associatedData?.isThumbnail);
        } else if (filterType === 'mods') {
            filtered = filtered.filter(f => f.associatedData?.isModFile);
        } else if (filterType === 'orphaned') {
            filtered = filtered.filter(f => f.isOrphaned);
        }

        // Sort
        filtered.sort((a, b) => {
            let aVal: any;
            let bVal: any;

            switch (sortField) {
                case 'uploaded':
                    aVal = a.uploaded.getTime();
                    bVal = b.uploaded.getTime();
                    break;
                case 'size':
                    aVal = a.size;
                    bVal = b.size;
                    break;
                case 'mod':
                    aVal = a.associatedData?.mod?.title || '';
                    bVal = b.associatedData?.mod?.title || '';
                    break;
                case 'customer':
                    aVal = extractCustomerId(a.key) || '';
                    bVal = extractCustomerId(b.key) || '';
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [getAllFiles, searchQuery, filterType, sortField, sortDirection]);

    const renderFileItem = useCallback((file: R2FileInfo, showCheckbox: boolean = true, _disableDelete: boolean = false) => {
        const associated = file.associatedData;
        const customerId = extractCustomerId(file.key);
        const isThumbnail = associated?.isThumbnail;
        const isModFile = associated?.isModFile;
        
        // Check if thumbnail is protected (associated with existing mod)
        const isThumbnailProtected = isThumbnail && associated?.mod !== undefined;
        
        // Get thumbnail URL if it's a thumbnail and we have mod slug
        const thumbnailUrl = isThumbnail && associated?.mod?.slug 
            ? `${API_BASE_URL}/mods/${associated.mod.slug}/thumbnail`
            : null;

        return (
            <FileItem key={file.key}>
                {showCheckbox && (
                    <Checkbox
                        type="checkbox"
                        checked={selectedFiles.has(file.key)}
                        onChange={() => toggleFileSelection(file.key)}
                    />
                )}
                {isThumbnail && thumbnailUrl ? (
                    <ThumbnailPreview>
                        <ThumbnailImage 
                            src={thumbnailUrl} 
                            alt={associated?.mod?.title || 'Thumbnail'}
                            onError={(e) => {
                                // If image fails to load, show placeholder
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const placeholder = target.parentElement?.querySelector('.thumbnail-placeholder') as HTMLElement;
                                if (placeholder) placeholder.style.display = 'flex';
                            }}
                        />
                        <ThumbnailPlaceholder className="thumbnail-placeholder" style={{ display: 'none' }}>
                            Thumbnail unavailable
                        </ThumbnailPlaceholder>
                    </ThumbnailPreview>
                ) : isThumbnail ? (
                    <ThumbnailPreview>
                        <ThumbnailPlaceholder>No mod data</ThumbnailPlaceholder>
                    </ThumbnailPreview>
                ) : (
                    <div style={{ width: '120px' }} /> // Spacer for alignment
                )}
                <FileInfo>
                    {associated?.mod ? (
                        <>
                            <FileTitle>
                                {isThumbnail ? '🖼️ Thumbnail for: ' : isModFile ? '📦 Mod File for: ' : ''}
                                <ModNameLink to={`/${associated.mod.slug}`} onClick={(e) => e.stopPropagation()}>
                                    {associated.mod.title}
                                </ModNameLink>
                            </FileTitle>
                            {isModFile && associated.version && (
                                <ModFileInfo>
                                    <div><strong>Version:</strong> {associated.version.version}</div>
                                    <div><strong>File:</strong> {associated.version.fileName}</div>
                                    {associated.version.gameVersions && associated.version.gameVersions.length > 0 && (
                                        <div><strong>Game Versions:</strong> {associated.version.gameVersions.join(', ')}</div>
                                    )}
                                </ModFileInfo>
                            )}
                            <FileDetails>
                                <FileDetailItem>
                                    <FileDetailLabel>Author:</FileDetailLabel>
                                    <span>{associated.mod.authorDisplayName || associated.mod.authorId}</span>
                                </FileDetailItem>
                                {customerId && (
                                    <FileDetailItem>
                                        <FileDetailLabel>Customer:</FileDetailLabel>
                                        <CustomerLink>{customerId}</CustomerLink>
                                    </FileDetailItem>
                                )}
                                {associated.uploadedBy && (
                                    <FileDetailItem>
                                        <FileDetailLabel>Uploaded By:</FileDetailLabel>
                                        <span>{associated.uploadedBy.displayName || associated.uploadedBy.userId}</span>
                                    </FileDetailItem>
                                )}
                                <FileDetailItem>
                                    <FileDetailLabel>Status:</FileDetailLabel>
                                    <Badge $variant={associated.mod.status === 'published' ? 'success' : associated.mod.status === 'approved' ? 'info' : 'warning'}>
                                        {associated.mod.status}
                                    </Badge>
                                </FileDetailItem>
                                <FileDetailItem>
                                    <FileDetailLabel>Downloads:</FileDetailLabel>
                                    <span>{associated.mod.downloadCount.toLocaleString()}</span>
                                </FileDetailItem>
                            </FileDetails>
                        </>
                    ) : (
                        <>
                            <FileTitle>
                                {isThumbnail ? '🖼️ Thumbnail' : isModFile ? '📦 Mod File' : '❓ Unknown File'}
                                {customerId && ` (Customer: ${customerId})`}
                            </FileTitle>
                            <FileDetails>
                                <FileDetailItem>
                                    <FileDetailLabel>Type:</FileDetailLabel>
                                    <span>{isThumbnail ? 'Thumbnail Image' : isModFile ? 'Mod Archive' : 'Unknown'}</span>
                                </FileDetailItem>
                                {customerId && (
                                    <FileDetailItem>
                                        <FileDetailLabel>Customer:</FileDetailLabel>
                                        <CustomerLink>{customerId}</CustomerLink>
                                    </FileDetailItem>
                                )}
                            </FileDetails>
                        </>
                    )}
                    <FileMeta>
                        <span><strong>Size:</strong> {formatBytes(file.size)}</span>
                        <span><strong>Uploaded:</strong> {file.uploaded.toLocaleDateString()} {file.uploaded.toLocaleTimeString()}</span>
                        {file.contentType && <span><strong>Type:</strong> {file.contentType}</span>}
                    </FileMeta>
                    <FileKey>{file.key}</FileKey>
                </FileInfo>
                <ActionButtons>
                    {file.isOrphaned && <Badge $variant="danger">Orphaned</Badge>}
                    {isThumbnail && <Badge $variant="info">Thumbnail</Badge>}
                    {isModFile && <Badge $variant="info">Mod File</Badge>}
                    {isThumbnailProtected && <Badge $variant="success">Protected</Badge>}
                </ActionButtons>
                <ActionButtons>
                    <Button
                        $variant="danger"
                        onClick={() => handleDeleteClick(file.key)}
                        disabled={deleteFileMutation.isPending}
                        title={isThumbnailProtected ? 'This thumbnail is associated with an existing mod. Click to delete with additional confirmation.' : undefined}
                    >
                        Delete
                    </Button>
                </ActionButtons>
            </FileItem>
        );
    }, [selectedFiles, toggleFileSelection, handleDeleteClick, deleteFileMutation.isPending]);

    const renderOrphanedFiles = () => {
        if (isLoadingDuplicates) return <Loading>Scanning for orphaned files...</Loading>;
        if (duplicatesError) return <Error>Failed to scan: {(duplicatesError as Error).message}</Error>;
        if (!duplicatesData) return null;

        const files = filteredAndSortedFiles;

        if (files.length === 0) {
            return <EmptyState>No orphaned files found. All files are referenced in KV.</EmptyState>;
        }

        return (
            <>
                <ControlsBar>
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                        <SearchInput
                            type="text"
                            placeholder="Search by mod, author, customer, or file key..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                            <option value="all">All Types</option>
                            <option value="thumbnails">Thumbnails Only</option>
                            <option value="mods">Mod Files Only</option>
                            <option value="orphaned">Orphaned Only</option>
                        </Select>
                        <Select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
                            <option value="uploaded">Sort by Date</option>
                            <option value="size">Sort by Size</option>
                            <option value="mod">Sort by Mod</option>
                            <option value="customer">Sort by Customer</option>
                        </Select>
                        <Button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                        </Button>
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button onClick={() => toggleSelectAll(files)}>
                            {files.length > 0 && files.every(f => selectedFiles.has(f.key)) ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>
                </ControlsBar>
                <SelectionBar>
                    <div>
                        {selectedFiles.size > 0 && (
                            <span style={{ fontWeight: 600 }}>{selectedFiles.size} file(s) selected</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button
                            $variant="danger"
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
                    {files.map((file) => renderFileItem(file, true, false))}
                </FileList>
            </>
        );
    };

    const renderDuplicates = () => {
        if (isLoadingDuplicates) return <Loading>Scanning for duplicates...</Loading>;
        if (duplicatesError) return <Error>Failed to scan: {(duplicatesError as Error).message}</Error>;
        if (!duplicatesData) return null;

        const groups = duplicatesData.duplicateGroups;
        const allFiles = filteredAndSortedFiles;

        if (groups.length === 0) {
            return <EmptyState>No duplicate files found.</EmptyState>;
        }

        return (
            <>
                <ControlsBar>
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                        <SearchInput
                            type="text"
                            placeholder="Search by mod, author, customer, or file key..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                            <option value="all">All Types</option>
                            <option value="thumbnails">Thumbnails Only</option>
                            <option value="mods">Mod Files Only</option>
                        </Select>
                        <Select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
                            <option value="uploaded">Sort by Date</option>
                            <option value="size">Sort by Size</option>
                            <option value="mod">Sort by Mod</option>
                            <option value="customer">Sort by Customer</option>
                        </Select>
                        <Button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                        </Button>
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button onClick={() => toggleSelectAll(allFiles)}>
                            {allFiles.length > 0 && allFiles.every(f => selectedFiles.has(f.key)) ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>
                </ControlsBar>
                <SelectionBar>
                    <div>
                        {selectedFiles.size > 0 && (
                            <span style={{ fontWeight: 600 }}>{selectedFiles.size} file(s) selected</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button
                            $variant="danger"
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
                <div>
                    {groups.map((group, index) => {
                        // Only show duplicate files (exclude the recommended keep file)
                        const duplicateFiles = group.files.filter(f => f.key !== group.recommendedKeep);
                        const groupFiles = duplicateFiles.filter(f => 
                            filteredAndSortedFiles.some(ff => ff.key === f.key)
                        );
                        if (groupFiles.length === 0) return null;
                        
                        return (
                            <DuplicateGroupCard key={index}>
                                <DuplicateGroupHeader>
                                    <DuplicateGroupTitle>
                                        {duplicateFiles.length} duplicate file(s) to remove - {formatBytes(group.totalSize)} total
                                        {group.recommendedKeep && (
                                            <span style={{ fontSize: '0.875rem', color: colors.textSecondary, marginLeft: spacing.sm }}>
                                                (1 file will be kept)
                                            </span>
                                        )}
                                    </DuplicateGroupTitle>
                                    <Badge $variant="warning">
                                        Wasted: {formatBytes(group.totalSize - (group.files[0]?.size || 0))}
                                    </Badge>
                                </DuplicateGroupHeader>
                                <DuplicateGroupFiles>
                                    {groupFiles.map((file) => (
                                        <div key={file.key}>
                                            {renderFileItem(file, true, false)}
                                        </div>
                                    ))}
                                </DuplicateGroupFiles>
                            </DuplicateGroupCard>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderFiles = () => {
        if (isLoadingFiles) return <Loading>Loading files...</Loading>;
        if (filesError) return <Error>Failed to load files: {(filesError as Error).message}</Error>;
        if (!filesData) return null;

        const files = filteredAndSortedFiles;

        if (files.length === 0) {
            return <EmptyState>No files found.</EmptyState>;
        }

        return (
            <>
                <ControlsBar>
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                        <SearchInput
                            type="text"
                            placeholder="Search by mod, author, customer, or file key..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <Select value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
                            <option value="all">All Types</option>
                            <option value="thumbnails">Thumbnails Only</option>
                            <option value="mods">Mod Files Only</option>
                            <option value="orphaned">Orphaned Only</option>
                        </Select>
                        <Select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)}>
                            <option value="uploaded">Sort by Date</option>
                            <option value="size">Sort by Size</option>
                            <option value="mod">Sort by Mod</option>
                            <option value="customer">Sort by Customer</option>
                        </Select>
                        <Button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                        </Button>
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button onClick={() => toggleSelectAll(files)}>
                            {files.length > 0 && files.every(f => selectedFiles.has(f.key)) ? 'Deselect All' : 'Select All'}
                        </Button>
                    </div>
                </ControlsBar>
                <SelectionBar>
                    <div>
                        {selectedFiles.size > 0 && (
                            <span style={{ fontWeight: 600 }}>{selectedFiles.size} file(s) selected</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button
                            $variant="danger"
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
                    {files.map((file) => renderFileItem(file, true, false))}
                </FileList>
            </>
        );
    };

    return (
        <PageContainer>
            <AdminNavigation />
            <PageHeader>
                <Title>R2 Management</Title>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                    <Button
                        $variant="primary"
                        onClick={() => {
                            if (activeTab === 'files') {
                                refetchFiles();
                            } else {
                                refetchDuplicates();
                            }
                        }}
                        disabled={isLoadingDuplicates || isLoadingFiles}
                    >
                        Refresh
                    </Button>
                </div>
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
                <Tab active={activeTab === 'duplicates'} onClick={() => {
                    setActiveTab('duplicates');
                    setSelectedFiles(new Set());
                }}>
                    Duplicates
                </Tab>
                <Tab active={activeTab === 'orphaned'} onClick={() => {
                    setActiveTab('orphaned');
                    setSelectedFiles(new Set());
                }}>
                    Orphaned Files
                </Tab>
                <Tab active={activeTab === 'files'} onClick={() => {
                    setActiveTab('files');
                    setSelectedFiles(new Set());
                }}>
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
            
            <ConfirmationModal
                isOpen={protectedFileModalOpen}
                onClose={() => {
                    setProtectedFileModalOpen(false);
                    setFileToDelete(null);
                    setProtectedFileInfo(null);
                }}
                onConfirm={handleProtectedFileConfirm}
                title="Delete Protected File"
                message={
                    protectedFileInfo?.reason 
                        ? `${protectedFileInfo.reason}\n\nAre you absolutely sure you want to delete this protected file? This will remove the thumbnail from the associated mod. This action cannot be undone.`
                        : `This file is protected because it is associated with an existing mod.\n\nAre you absolutely sure you want to delete this protected file? This action cannot be undone.`
                }
                confirmText="Yes, Delete Protected File"
                cancelText="Cancel"
                isLoading={deleteFileMutation.isPending || bulkDeleteMutation.isPending}
            />
        </PageContainer>
    );
}
