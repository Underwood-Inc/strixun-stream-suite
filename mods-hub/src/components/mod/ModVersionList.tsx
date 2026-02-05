/**
 * Mod version list component
 * Displays all versions with download links in expandable accordions
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion, ModVariant } from '../../types/mod';
import { downloadVersion, downloadVariant } from '../../services/mods';
import { IntegrityBadge } from './IntegrityBadge';
import { celebrateClick } from '../../utils/confetti';
import { getButtonStyles } from '../../utils/buttonStyles';
import { getCardStyles } from '../../utils/sharedStyles';
import { candyShopAnimation } from '../../utils/candyShopAnimation';
import { useAuthStore } from '../../stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { modKeys } from '../../hooks/useMods';
import { formatDateTime, formatRelativeTime } from '@strixun/shared-config/date-utils';
import { MarkdownContent } from '../common/MarkdownContent';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const TitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.md};
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const SortButton = styled.button`
  ${getButtonStyles('secondary')}
  font-size: 0.75rem;
  padding: ${spacing.xs} ${spacing.sm};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const VersionCard = styled.div<{ $isExpanded: boolean; $isSelected?: boolean }>`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${props => props.$isExpanded ? spacing.md : '0'};
  transition: all 0.2s ease;
  
  ${props => props.$isSelected && `
    border: 2px solid ${colors.accent};
    box-shadow: 0 0 12px ${colors.accent}40;
    position: relative;
    
    &::before {
      content: 'SELECTED';
      position: absolute;
      top: -1px;
      right: ${spacing.md};
      background: ${colors.accent};
      color: #000;
      font-size: 0.625rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 0 0 4px 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `}
`;

const VersionCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  flex: 1;
  justify-content: space-between;
`;

const VersionMeta = styled.div`
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

const ChangelogContainer = styled.div`
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${colors.card};
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 3px;
  }
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.md};
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const DownloadButton = styled.button`
  ${getButtonStyles('primary')}
  ${candyShopAnimation}
`;

const ManageButton = styled.button`
  ${getButtonStyles('secondary')}
  font-size: 0.875rem;
`;

const VersionActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const CopyLinkButton = styled.button`
  background: transparent;
  border: 1px solid ${colors.border};
  color: ${colors.textSecondary};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  position: relative;
  
  &:hover {
    background: ${colors.bgTertiary};
    color: ${colors.text};
    border-color: ${colors.accent};
  }
`;

const CopiedToast = styled.span`
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  background: ${colors.success};
  color: #000;
  font-size: 0.675rem;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  animation: fadeInOut 1.5s ease forwards;
  
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(5px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-5px); }
  }
`;

const ExpandButton = styled.button`
  background: transparent;
  border: none;
  color: ${colors.textMuted};
  cursor: pointer;
  padding: ${spacing.xs};
  font-size: 0.75rem;
  transition: transform 0.2s ease, color 0.2s ease;
  
  &:hover {
    color: ${colors.text};
  }
`;

const ExpandedContent = styled.div<{ $isExpanded: boolean }>`
  max-height: ${props => props.$isExpanded ? '2000px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${props => props.$isExpanded ? `1px solid ${colors.border}` : 'none'};
  padding-top: ${props => props.$isExpanded ? spacing.md : '0'};
  margin-top: ${props => props.$isExpanded ? spacing.md : '0'};
`;

const NoVariantsMessage = styled.p`
  color: ${colors.textMuted};
  font-size: 0.875rem;
  font-style: italic;
  margin: 0;
  padding: ${spacing.md};
  text-align: center;
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

const VariantDescription = styled.div`
  font-size: 0.75rem;
  color: ${colors.textSecondary};
  margin: 0;
  line-height: 1.4;
  max-height: 300px;
  overflow: hidden;
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
  ${candyShopAnimation}
  font-size: 0.875rem;
  padding: ${spacing.xs} ${spacing.sm};
`;

interface ModVersionListProps {
    modSlug: string; // Mod slug for constructing download URLs
    versions: ModVersion[];
    variants?: ModVariant[]; // Variants for the mod (filtered by version)
    authorId?: string; // Mod author ID for checking ownership
    selectedVersionId?: string; // Currently selected version ID (from URL)
}

type SortOrder = 'newest' | 'oldest';

export function ModVersionList({ modSlug, versions, variants = [], authorId, selectedVersionId }: ModVersionListProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, customer } = useAuthStore();
    const isUploader = customer?.customerId === authorId;
    const queryClient = useQueryClient();
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [downloadingVariants, setDownloadingVariants] = useState<Set<string>>(new Set());
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [copiedVersionId, setCopiedVersionId] = useState<string | null>(null);
    
    // Refs for scrolling to selected version
    const versionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    
    // Scroll to selected version on mount or when selection changes
    useEffect(() => {
        if (selectedVersionId) {
            const element = versionRefs.current.get(selectedVersionId);
            if (element) {
                // Small delay to ensure layout is complete
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }, [selectedVersionId]);
    
    // Generate version URL for copying
    const getVersionUrl = (version: ModVersion) => {
        const isModsPath = location.pathname.startsWith('/mods/');
        const basePath = isModsPath ? `/mods/${modSlug}` : `/${modSlug}`;
        return `${window.location.origin}${basePath}/v/${version.version}`;
    };
    
    // Copy version link to clipboard
    const handleCopyLink = async (e: React.MouseEvent, version: ModVersion) => {
        e.stopPropagation(); // Prevent accordion toggle
        const url = getVersionUrl(version);
        try {
            await navigator.clipboard.writeText(url);
            setCopiedVersionId(version.versionId);
            setTimeout(() => setCopiedVersionId(null), 1500);
        } catch (err) {
            console.error('Failed to copy link:', err);
        }
    };

    // Sort versions by createdAt timestamp (includes full time precision)
    const sortedVersions = [...versions].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        // Newest first (descending) or oldest first (ascending)
        return sortOrder === 'newest' 
            ? (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime)
            : (isNaN(aTime) ? 0 : aTime) - (isNaN(bTime) ? 0 : bTime);
    });

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
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

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            // Download variant - filename is automatically extracted from Content-Disposition header
            // This preserves the exact filename that was originally uploaded
            await downloadVariant(modSlug, variant.variantId);
            
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

    // Variants are tied to specific mod versions via parentVersionId
    // Each version shows only its own variants in the expanded accordion
    // Variants have their own version control system via VariantVersion

    return (
        <Container>
            <TitleRow>
                <Title>Versions ({versions.length})</Title>
                <SortButton onClick={toggleSortOrder} title={`Currently showing ${sortOrder} first. Click to reverse.`}>
                    {sortOrder === 'newest' ? '↓ Newest First' : '↑ Oldest First'}
                </SortButton>
            </TitleRow>
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
            {sortedVersions.map((version) => {
                const isExpanded = expandedVersions.has(version.versionId);
                const isSelected = version.versionId === selectedVersionId;
                // Filter variants to only show those attached to this specific version
                const versionVariants = variants.filter(v => v.parentVersionId === version.versionId);
                return (
                    <VersionCard 
                        key={version.versionId} 
                        $isExpanded={isExpanded}
                        $isSelected={isSelected}
                        ref={(el) => {
                            if (el) {
                                versionRefs.current.set(version.versionId, el);
                            } else {
                                versionRefs.current.delete(version.versionId);
                            }
                        }}
                    >
                        <VersionCardHeader onClick={() => toggleVersion(version.versionId)}>
                            <VersionInfo>
                                <VersionHeader>
                                    <VersionMeta>
                                        <VersionNumber>v{version.version}</VersionNumber>
                                        <VersionDate title={formatDateTime(version.createdAt)}>
                                            {formatRelativeTime(version.createdAt)}
                                        </VersionDate>
                                    </VersionMeta>
                                    <VersionActions>
                                        {isUploader && (
                                            <ManageButton
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/manage/${modSlug}`);
                                                }}
                                            >
                                                Manage
                                            </ManageButton>
                                        )}
                                        <CopyLinkButton
                                            onClick={(e) => handleCopyLink(e, version)}
                                            title="Copy link to this version"
                                        >
                                            📋 Link
                                            {copiedVersionId === version.versionId && (
                                                <CopiedToast>Copied!</CopiedToast>
                                            )}
                                        </CopyLinkButton>
                                        <DownloadButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                celebrateClick(e.currentTarget);
                                                handleDownload(version);
                                            }}
                                            disabled={downloading.has(version.versionId) || !isAuthenticated}
                                            title={!isAuthenticated ? 'Please log in to download' : undefined}
                                        >
                                            {downloading.has(version.versionId) ? 'Downloading...' : 'Download'}
                                        </DownloadButton>
                                    </VersionActions>
                                </VersionHeader>
                                {version.changelog && (
                                    <ChangelogContainer>
                                        <MarkdownContent content={version.changelog} />
                                    </ChangelogContainer>
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
                        </VersionCardHeader>
                        <ExpandedContent $isExpanded={isExpanded}>
                            {versionVariants.length > 0 ? (
                                <VariantsSection>
                                    <VariantsTitle>Variants ({versionVariants.length})</VariantsTitle>
                                    <div style={{ 
                                        padding: spacing.sm, 
                                        background: `${colors.accent}20`, 
                                        color: colors.textSecondary, 
                                        borderRadius: 4,
                                        fontSize: '0.875rem',
                                        marginBottom: spacing.md
                                    }}>
                                        ℹ Variants are alternative versions of this mod release. 
                                        Download the latest version of each variant below.
                                    </div>
                                    {versionVariants.map((variant) => (
                                        <VariantCard key={variant.variantId}>
                                            <VariantInfo>
                                                <VariantName>{variant.name}</VariantName>
                                                {variant.description && (
                                                    <VariantDescription>
                                                        <MarkdownContent content={variant.description} />
                                                    </VariantDescription>
                                                )}
                                                <VariantMeta>
                                                    <span>{variant.versionCount} version{variant.versionCount !== 1 ? 's' : ''}</span>
                                                    <span>•</span>
                                                    <span>{variant.totalDownloads} total downloads</span>
                                                    <span>•</span>
                                                    <span title={formatDateTime(variant.createdAt)}>
                                                        Created: {formatRelativeTime(variant.createdAt)}
                                                    </span>
                                                </VariantMeta>
                                                {variant.currentVersionId && (
                                                    <IntegrityBadge 
                                                        slug={modSlug}
                                                        versionId={variant.currentVersionId}
                                                    />
                                                )}
                                            </VariantInfo>
                                            <VariantDownloadButton
                                                onClick={(e) => {
                                                    celebrateClick(e.currentTarget);
                                                    handleVariantDownload(variant);
                                                }}
                                                disabled={downloadingVariants.has(variant.variantId) || !variant.variantId || !isAuthenticated}
                                                title={!isAuthenticated ? 'Please log in to download' : undefined}
                                            >
                                                {downloadingVariants.has(variant.variantId) ? 'Downloading...' : 'Download Latest'}
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

