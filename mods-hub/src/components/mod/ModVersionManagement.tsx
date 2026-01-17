/**
 * Mod version management component
 * Lists all mod versions with actions to edit/delete
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion, VersionUploadRequest, ModVariant } from '../../types/mod';
import { formatDate } from '@strixun/shared-config/date-utils';
import { downloadVersion } from '../../services/mods';
import { IntegrityBadge } from './IntegrityBadge';
import { celebrateClick } from '../../utils/confetti';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { candyShopAnimation } from '../../utils/candyShopAnimation';
import { useAuthStore } from '../../stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { modKeys, useDeleteModVersion, useUpdateModVersion, useUpdateMod } from '../../hooks/useMods';
import { MarkdownEditor } from '../common/MarkdownEditor';
import { MarkdownContent } from '../common/MarkdownContent';
import { VersionVariantManager } from './VersionVariantManager';

const Container = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const VersionCard = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const VersionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const VersionInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const VersionNumber = styled.span`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${colors.accent};
`;

const VersionDate = styled.span`
  font-size: 0.875rem;
  color: ${colors.textMuted};
`;

const Changelog = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
  max-height: 300px;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.md};
  font-size: 0.75rem;
  color: ${colors.textMuted};
  flex-wrap: wrap;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
  flex-wrap: wrap;
`;

const DownloadButton = styled.button`
  ${getButtonStyles('primary')}
  ${candyShopAnimation}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.md};
`;

const ActionButton = styled.button<{ $variant?: 'danger' | 'secondary' }>`
  ${props => getButtonStyles(props.$variant === 'danger' ? 'danger' : 'secondary')}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const EditForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bgTertiary};
  border-radius: 4px;
  border: 1px solid ${colors.border};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const Label = styled.label`
  font-weight: 500;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const Input = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const FormButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.sm};
  justify-content: flex-end;
`;

const EmptyState = styled.div`
  padding: ${spacing.xl};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgTertiary};
  border-radius: 4px;
`;

interface ModVersionManagementProps {
    modSlug: string;
    modId: string;
    versions: ModVersion[];
    variants: ModVariant[];
}

export function ModVersionManagement({ modSlug, modId, versions, variants }: ModVersionManagementProps) {
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [editingVersion, setEditingVersion] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<VersionUploadRequest>>({});
    const [managingVariantsFor, setManagingVariantsFor] = useState<string | null>(null);
    
    const deleteVersion = useDeleteModVersion();
    const updateVersion = useUpdateModVersion();
    const updateMod = useUpdateMod();

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };


    const handleDownload = async (version: ModVersion) => {
        if (!isAuthenticated) {
            setDownloadError('Please log in to download files');
            setTimeout(() => setDownloadError(null), 3000);
            return;
        }

        setDownloading(prev => new Set(prev).add(version.versionId));
        setDownloadError(null);
        
        try {
            await downloadVersion(modSlug, version.versionId, version.fileName || `mod-${modSlug}-v${version.version}.jar`);
            await queryClient.refetchQueries({ queryKey: modKeys.detail(modSlug) });
        } catch (error: any) {
            console.error('[ModVersionManagement] Download failed:', error);
            setDownloadError(error.message || 'Failed to download file');
            setTimeout(() => setDownloadError(null), 5000);
        } finally {
            setDownloading(prev => {
                const next = new Set(prev);
                next.delete(version.versionId);
                return next;
            });
        }
    };

    const handleEdit = (version: ModVersion) => {
        setEditingVersion(version.versionId);
        setEditFormData({
            version: version.version,
            changelog: version.changelog,
            gameVersions: version.gameVersions,
        });
    };

    const handleCancelEdit = () => {
        setEditingVersion(null);
        setEditFormData({});
    };

    const handleSaveEdit = async (e: React.FormEvent, versionId: string) => {
        e.preventDefault();
        try {
            await updateVersion.mutateAsync({
                modId,
                versionId,
                updates: editFormData,
            });
            setEditingVersion(null);
            setEditFormData({});
        } catch {
            // Error handled by mutation
        }
    };

    const handleDelete = async (version: ModVersion) => {
        if (!confirm(`Are you sure you want to delete version ${version.version}? This action cannot be undone.`)) {
            return;
        }
        try {
            await deleteVersion.mutateAsync({
                modId,
                versionId: version.versionId,
            });
        } catch {
            // Error handled by mutation
        }
    };

    const handleVariantCreated = () => {
        // Refetch mod data to show new variant
        queryClient.refetchQueries({ queryKey: modKeys.detail(modSlug) });
    };

    const handleVariantUpdated = () => {
        // Refetch mod data to show updated variant
        queryClient.refetchQueries({ queryKey: modKeys.detail(modSlug) });
    };

    if (versions.length === 0) {
        return (
            <Container>
                <Title>Version Management</Title>
                <EmptyState>
                    No versions available yet. Upload your first version above!
                </EmptyState>
            </Container>
        );
    }

    return (
        <Container>
            <Title>Version Management ({versions.length})</Title>
            {downloadError && (
                <div style={{ 
                    padding: spacing.md, 
                    background: `${colors.danger}20`, 
                    color: colors.danger, 
                    borderRadius: 4,
                    marginBottom: spacing.md
                }}>
                    {downloadError}
                </div>
            )}
            {versions.map((version) => {
                const isEditing = editingVersion === version.versionId;
                
                return (
                    <VersionCard key={version.versionId}>
                        <VersionHeader>
                            <VersionInfo>
                                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                    <VersionNumber>v{version.version}</VersionNumber>
                                    <VersionDate>{formatDate(version.createdAt)}</VersionDate>
                                </div>
                                {!isEditing && version.changelog && (
                                    <Changelog>
                                        <MarkdownContent content={version.changelog} />
                                    </Changelog>
                                )}
                                <Meta>
                                    <span>{formatFileSize(version.fileSize)}</span>
                                    <span>•</span>
                                    <span>{version.downloads} downloads</span>
                                    {version.gameVersions.length > 0 && (
                                        <>
                                            <span>•</span>
                                            <span>Game: {version.gameVersions.join(', ')}</span>
                                        </>
                                    )}
                                    <span>•</span>
                                    <span>{version.fileName}</span>
                                </Meta>
                                {version.sha256 && (
                                    <IntegrityBadge 
                                        slug={modSlug}
                                        versionId={version.versionId}
                                    />
                                )}
                            </VersionInfo>
                            <ButtonGroup>
                                <DownloadButton
                                    onClick={(e) => {
                                        celebrateClick(e.currentTarget);
                                        handleDownload(version);
                                    }}
                                    disabled={downloading.has(version.versionId) || !isAuthenticated}
                                    title={!isAuthenticated ? 'Please log in to download' : undefined}
                                >
                                    {downloading.has(version.versionId) ? 'Downloading...' : 'Download'}
                                </DownloadButton>
                                {!isEditing && (
                                    <>
                                        <ActionButton onClick={() => handleEdit(version)}>
                                            Edit
                                        </ActionButton>
                                        <ActionButton 
                                            onClick={() => setManagingVariantsFor(
                                                managingVariantsFor === version.versionId ? null : version.versionId
                                            )}
                                        >
                                            {managingVariantsFor === version.versionId ? 'Hide' : 'Manage'} Variants
                                        </ActionButton>
                                        <ActionButton 
                                            $variant="danger"
                                            onClick={() => handleDelete(version)}
                                        >
                                            Delete
                                        </ActionButton>
                                    </>
                                )}
                            </ButtonGroup>
                        </VersionHeader>
                        
                        {isEditing && (
                            <EditForm onSubmit={(e) => handleSaveEdit(e, version.versionId)}>
                                <FormGroup>
                                    <Label>Version Number</Label>
                                    <Input
                                        type="text"
                                        value={editFormData.version || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, version: e.target.value })}
                                        placeholder="1.0.0"
                                    />
                                </FormGroup>
                                
                                <FormGroup>
                                    <MarkdownEditor
                                        label="Changelog"
                                        value={editFormData.changelog || ''}
                                        onChange={(value) => setEditFormData({ ...editFormData, changelog: value })}
                                        placeholder="What's new in this version?"
                                        height={200}
                                        preview="live"
                                    />
                                </FormGroup>
                                
                                <FormGroup>
                                    <Label>Game Versions (comma-separated)</Label>
                                    <Input
                                        type="text"
                                        value={editFormData.gameVersions?.join(', ') || ''}
                                        onChange={(e) => setEditFormData({ 
                                            ...editFormData, 
                                            gameVersions: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                                        })}
                                        placeholder="1.0.0, 1.1.0"
                                    />
                                </FormGroup>
                                
                                <FormButtonGroup>
                                    <ActionButton type="button" onClick={handleCancelEdit}>
                                        Cancel
                                    </ActionButton>
                                    <ActionButton type="submit" disabled={updateVersion.isPending}>
                                        {updateVersion.isPending ? 'Saving...' : 'Save Changes'}
                                    </ActionButton>
                                </FormButtonGroup>
                            </EditForm>
                        )}
                        
                        {managingVariantsFor === version.versionId && (
                            <VersionVariantManager
                                version={version}
                                modSlug={modSlug}
                                existingVariants={variants}
                                onVariantCreated={handleVariantCreated}
                                _onVariantUpdated={handleVariantUpdated}
                                isLoading={updateMod.isPending}
                            />
                        )}
                    </VersionCard>
                );
            })}
        </Container>
    );
}
