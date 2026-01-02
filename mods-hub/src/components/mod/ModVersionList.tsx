/**
 * Mod version list component
 * Displays all versions with download links in expandable accordions
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion, ModVariant } from '../../types/mod';
import { downloadVersion, downloadVariant } from '../../services/api';
import { IntegrityBadge } from './IntegrityBadge';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { useAuthStore } from '../../stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { modKeys } from '../../hooks/useMods';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const VersionCard = styled.div<{ isExpanded: boolean }>`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${props => props.isExpanded ? spacing.md : '0'};
  transition: all 0.2s ease;
`;

const VersionCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.lg};
  cursor: pointer;
  user-select: none;
`;

const VersionInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const VersionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
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

const Changelog = styled.p`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.md};
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const ExpandButton = styled.button`
  background: none;
  border: none;
  color: ${colors.textSecondary};
  font-size: 1.25rem;
  cursor: pointer;
  padding: ${spacing.xs};
  display: flex;
  align-items: center;
  transition: transform 0.2s ease, color 0.2s ease;
  
  &:hover {
    color: ${colors.text};
  }
`;

const DownloadButton = styled.button`
  ${getButtonStyles('primary')}
`;

const ExpandedContent = styled.div<{ isExpanded: boolean }>`
  max-height: ${props => props.isExpanded ? '2000px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${props => props.isExpanded ? `1px solid ${colors.border}` : 'none'};
  padding-top: ${props => props.isExpanded ? spacing.md : '0'};
`;

const VariantsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  margin-top: ${spacing.md};
`;

const VariantsTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const VariantCard = styled.div`
  ${getCardStyles('default')}
  padding: ${spacing.md};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const VariantInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const VariantName = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${colors.text};
`;

const VariantDescription = styled.p`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  margin: 0;
  line-height: 1.4;
`;

const VariantMeta = styled.div`
  display: flex;
  gap: ${spacing.sm};
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-top: ${spacing.xs};
`;

const VariantDownloadButton = styled.button`
  ${getButtonStyles('secondary')}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

const NoVariantsMessage = styled.div`
  padding: ${spacing.md};
  text-align: center;
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgTertiary};
  border-radius: 4px;
`;

interface ModVersionListProps {
    modSlug: string; // Mod slug for constructing download URLs
    versions: ModVersion[];
    variants?: ModVariant[]; // Variants for the mod (filtered by version)
}

export function ModVersionList({ modSlug, versions, variants = [] }: ModVersionListProps) {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [downloadingVariants, setDownloadingVariants] = useState<Set<string>>(new Set());
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString();
    };

    const toggleVersion = (versionId: string) => {
        setExpandedVersions(prev => {
            const next = new Set(prev);
            if (next.has(versionId)) {
                next.delete(versionId);
            } else {
                next.add(versionId);
            }
            return next;
        });
    };

    const handleDownload = async (version: ModVersion) => {
        // SECURITY: Prevent unauthenticated download attempts
        if (!isAuthenticated) {
            setDownloadError('Please log in to download files');
            setTimeout(() => {
                setDownloadError(null);
                navigate('/login');
            }, 2000);
            return;
        }

        setDownloading(prev => new Set(prev).add(version.versionId));
        setDownloadError(null);
        
        try {
            // PESSIMISTIC UPDATE: Wait for download to complete before updating UI
            await downloadVersion(modSlug, version.versionId, version.fileName || `mod-${modSlug}-v${version.version}.jar`);
            
            // Download successful - refetch mod data to get updated download counts
            console.log('[ModVersionList] Download completed, refetching mod data for updated counts');
            await queryClient.refetchQueries({ queryKey: modKeys.detail(modSlug) });
        } catch (error: any) {
            console.error('[ModVersionList] Download failed:', error);
            setDownloadError(error.message || 'Failed to download file');
            // Show error for a few seconds
            setTimeout(() => setDownloadError(null), 5000);
        } finally {
            setDownloading(prev => {
                const next = new Set(prev);
                next.delete(version.versionId);
                return next;
            });
        }
    };

    const handleVariantDownload = async (variant: ModVariant) => {
        // SECURITY: Prevent unauthenticated download attempts
        if (!isAuthenticated) {
            setDownloadError('Please log in to download files');
            setTimeout(() => {
                setDownloadError(null);
                navigate('/login');
            }, 2000);
            return;
        }

        if (!variant.variantId) {
            setDownloadError('Variant ID not available');
            setTimeout(() => setDownloadError(null), 5000);
            return;
        }

        setDownloadingVariants(prev => new Set(prev).add(variant.variantId));
        setDownloadError(null);

        try {
            // PESSIMISTIC UPDATE: Wait for download to complete before updating UI
            const fileName = variant.fileName || `${variant.name || 'variant'}.zip`;
            await downloadVariant(modSlug, variant.variantId, fileName);
            
            // Download successful - refetch mod data to get updated download counts
            console.log('[ModVersionList] Variant download completed, refetching mod data for updated counts');
            await queryClient.refetchQueries({ queryKey: modKeys.detail(modSlug) });
        } catch (error: any) {
            console.error('[ModVersionList] Variant download failed:', error);
            setDownloadError(error.message || 'Failed to download variant');
            setTimeout(() => setDownloadError(null), 5000);
        } finally {
            setDownloadingVariants(prev => {
                const next = new Set(prev);
                next.delete(variant.variantId);
                return next;
            });
        }
    };

    // Filter variants by version
    const getVariantsForVersion = (version: ModVersion): ModVariant[] => {
        return variants.filter(v => v.version === version.version || !v.version);
    };

    return (
        <Container>
            <Title>Versions ({versions.length})</Title>
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
                const isExpanded = expandedVersions.has(version.versionId);
                const versionVariants = getVariantsForVersion(version);
                
                // Calculate cumulative downloads for this version (version + all variants)
                const variantDownloads = versionVariants.reduce((sum, v) => sum + (v.downloads || 0), 0);
                const cumulativeDownloads = version.downloads + variantDownloads;
                
                return (
                    <VersionCard key={version.versionId} isExpanded={isExpanded}>
                        <VersionCardHeader onClick={() => toggleVersion(version.versionId)}>
                            <VersionInfo>
                                <VersionHeader>
                                    <VersionNumber>v{version.version}</VersionNumber>
                                    <VersionDate>{formatDate(version.createdAt)}</VersionDate>
                                </VersionHeader>
                                {version.changelog && <Changelog>{version.changelog}</Changelog>}
                                <Meta>
                                    <span>{formatFileSize(version.fileSize)}</span>
                                    <span>•</span>
                                    <span>{cumulativeDownloads} downloads{versionVariants.length > 0 ? ` (${version.downloads} main + ${variantDownloads} variants)` : ''}</span>
                                    {version.gameVersions.length > 0 && (
                                        <>
                                            <span>•</span>
                                            <span>Game: {version.gameVersions.join(', ')}</span>
                                        </>
                                    )}
                                    {versionVariants.length > 0 && (
                                        <>
                                            <span>•</span>
                                            <span>{versionVariants.length} variant{versionVariants.length !== 1 ? 's' : ''}</span>
                                        </>
                                    )}
                                </Meta>
                                {version.sha256 && (
                                    <IntegrityBadge 
                                        slug={modSlug}
                                        versionId={version.versionId}
                                    />
                                )}
                            </VersionInfo>
                            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                                <DownloadButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(version);
                                    }}
                                    disabled={downloading.has(version.versionId) || !isAuthenticated}
                                    title={!isAuthenticated ? 'Please log in to download' : undefined}
                                >
                                    {downloading.has(version.versionId) ? 'Downloading...' : 'Download'}
                                </DownloadButton>
                                <ExpandButton
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleVersion(version.versionId);
                                    }}
                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    ▼
                                </ExpandButton>
                            </div>
                        </VersionCardHeader>
                        <ExpandedContent isExpanded={isExpanded}>
                            {versionVariants.length > 0 ? (
                                <VariantsSection>
                                    <VariantsTitle>Variants ({versionVariants.length})</VariantsTitle>
                                    {versionVariants.map((variant) => (
                                        <VariantCard key={variant.variantId}>
                                            <VariantInfo>
                                                <VariantName>{variant.name}</VariantName>
                                                {variant.description && (
                                                    <VariantDescription>{variant.description}</VariantDescription>
                                                )}
                                                <VariantMeta>
                                                    {variant.fileSize && (
                                                        <>
                                                            <span>{formatFileSize(variant.fileSize)}</span>
                                                            <span>•</span>
                                                        </>
                                                    )}
                                                    <span>{(variant.downloads || 0)} downloads</span>
                                                    {variant.fileName && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{variant.fileName}</span>
                                                        </>
                                                    )}
                                                    {variant.gameVersions && variant.gameVersions.length > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Game: {variant.gameVersions.join(', ')}</span>
                                                        </>
                                                    )}
                                                </VariantMeta>
                                            </VariantInfo>
                                            <VariantDownloadButton
                                                onClick={() => handleVariantDownload(variant)}
                                                disabled={downloadingVariants.has(variant.variantId) || !variant.variantId || !isAuthenticated}
                                                title={!isAuthenticated ? 'Please log in to download' : undefined}
                                            >
                                                {downloadingVariants.has(variant.variantId) ? 'Downloading...' : 'Download'}
                                            </VariantDownloadButton>
                                        </VariantCard>
                                    ))}
                                </VariantsSection>
                            ) : (
                                <NoVariantsMessage>
                                    No variants available for this version
                                </NoVariantsMessage>
                            )}
                        </ExpandedContent>
                    </VersionCard>
                );
            })}
        </Container>
    );
}

