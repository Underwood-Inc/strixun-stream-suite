/**
 * Variant version list component
 * Displays all versions of a variant with download links and management actions
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { VariantVersion } from '../../types/mod';
import { downloadVersion } from '../../services/mods';
import { IntegrityBadge } from './IntegrityBadge';
import { celebrateClick } from '../../utils/confetti';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { candyShopAnimation } from '../../utils/candyShopAnimation';
import { useAuthStore } from '../../stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { modKeys } from '../../hooks/useMods';
import { formatDate } from '@strixun/shared-config/date-utils';
import { Preview } from '../common/RichTextEditor/Preview';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0 0 ${spacing.md} 0;
`;

const VersionCard = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
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
  gap: ${spacing.xs};
`;

const VersionNumber = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: ${colors.accent};
`;

const VersionDate = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const ChangelogContainer = styled.div`
  margin: 0;
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.sm};
  font-size: 0.75rem;
  color: ${colors.textMuted};
  flex-wrap: wrap;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${spacing.sm};
  align-items: center;
`;

const DownloadButton = styled.button`
  ${getButtonStyles('primary')}
  ${candyShopAnimation}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.md};
`;

const ActionButton = styled.button<{ $variant?: 'danger' }>`
  ${props => getButtonStyles(props.$variant === 'danger' ? 'danger' : 'secondary')}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const EmptyState = styled.div`
  padding: ${spacing.xl};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgTertiary};
  border-radius: 4px;
`;

interface VariantVersionListProps {
    modSlug: string;
    variantId: string;
    variantName: string;
    parentVersionId: string;
    versions: VariantVersion[];
    canManage?: boolean;
    onEdit?: (version: VariantVersion) => void;
    onDelete?: (version: VariantVersion) => void;
}

export function VariantVersionList({ 
    modSlug,
    variantId,
    variantName,
    parentVersionId,
    versions,
    canManage = false,
    onEdit,
    onDelete
}: VariantVersionListProps) {
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };


    const handleDownload = async (version: VariantVersion) => {
        if (!isAuthenticated) {
            setDownloadError('Please log in to download files');
            setTimeout(() => setDownloadError(null), 3000);
            return;
        }

        setDownloading(prev => new Set(prev).add(version.variantVersionId));
        setDownloadError(null);
        
        try {
            if (!version.fileName) {
                throw new Error('Variant version file name not found');
            }
            await downloadVersion(
                modSlug, 
                version.variantVersionId, 
                version.fileName
            );
            
            // Optimistic UI: immediately increment counts in the cache
            queryClient.setQueryData(modKeys.detail(modSlug), (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    mod: {
                        ...old.mod,
                        downloadCount: (old.mod.downloadCount || 0) + 1,
                        variants: old.mod.variants?.map((v: any) =>
                            v.variantId === variantId
                                ? { ...v, totalDownloads: (v.totalDownloads || 0) + 1 }
                                : v
                        ),
                    },
                    versions: old.versions.map((v: any) =>
                        v.versionId === parentVersionId
                            ? { ...v, downloads: (v.downloads || 0) + 1 }
                            : v
                    ),
                };
            });
            queryClient.setQueryData(modKeys.variantVersions(modSlug, variantId), (old: any) => {
                if (!old?.versions) return old;
                return {
                    ...old,
                    versions: old.versions.map((v: any) =>
                        v.variantVersionId === version.variantVersionId
                            ? { ...v, downloads: (v.downloads || 0) + 1 }
                            : v
                    ),
                };
            });
        } catch (error: any) {
            console.error('[VariantVersionList] Download failed:', error);
            setDownloadError(error.message || 'Failed to download file');
            setTimeout(() => setDownloadError(null), 5000);
        } finally {
            setDownloading(prev => {
                const next = new Set(prev);
                next.delete(version.variantVersionId);
                return next;
            });
        }
    };

    const handleDelete = (version: VariantVersion) => {
        if (!confirm(`Are you sure you want to delete version ${version.version}? This action cannot be undone.`)) {
            return;
        }
        onDelete?.(version);
    };

    if (versions.length === 0) {
        return (
            <Container>
                <Title>Versions for &quot;{variantName}&quot;</Title>
                <EmptyState>
                    No versions available for this variant yet.
                </EmptyState>
            </Container>
        );
    }

    return (
        <Container>
            <Title>Versions for &quot;{variantName}&quot; ({versions.length})</Title>
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
            {versions.map((version) => (
                <VersionCard key={version.variantVersionId}>
                    <VersionHeader>
                        <VersionInfo>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                                <VersionNumber>v{version.version}</VersionNumber>
                                <VersionDate>{formatDate(version.createdAt)}</VersionDate>
                            </div>
                            {version.changelog && (
                                                <ChangelogContainer>
                                                    <Preview content={version.changelog} />
                                                </ChangelogContainer>
                                            )}
                            <Meta>
                                <span>{formatFileSize(version.fileSize)}</span>
                                <span>•</span>
                                <span>{version.downloads} downloads</span>
                                {version.gameVersions && version.gameVersions.length > 0 && (
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
                                    versionId={version.variantVersionId}
                                />
                            )}
                        </VersionInfo>
                        <ButtonGroup>
                            <DownloadButton
                                onClick={(e) => {
                                    celebrateClick(e.currentTarget);
                                    handleDownload(version);
                                }}
                                disabled={downloading.has(version.variantVersionId) || !isAuthenticated}
                                title={!isAuthenticated ? 'Please log in to download' : undefined}
                            >
                                {downloading.has(version.variantVersionId) ? 'Downloading...' : 'Download'}
                            </DownloadButton>
                            {canManage && (
                                <>
                                    {onEdit && (
                                        <ActionButton onClick={() => onEdit(version)}>
                                            Edit
                                        </ActionButton>
                                    )}
                                    {onDelete && (
                                        <ActionButton 
                                            $variant="danger"
                                            onClick={() => handleDelete(version)}
                                        >
                                            Delete
                                        </ActionButton>
                                    )}
                                </>
                            )}
                        </ButtonGroup>
                    </VersionHeader>
                </VersionCard>
            ))}
        </Container>
    );
}
