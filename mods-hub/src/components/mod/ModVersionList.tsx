/**
 * Mod version list component
 * Displays all versions with download links
 */

import { useState } from 'react';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion } from '../../types/mod';
import { downloadVersion } from '../../services/api';
import { IntegrityBadge } from './IntegrityBadge';

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

const VersionCard = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.lg};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.lg};
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

const DownloadButton = styled.button`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.accent};
  color: ${colors.bg};
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface ModVersionListProps {
    modSlug: string; // Mod slug for constructing download URLs
    versions: ModVersion[];
    isUploader?: boolean;
}

export function ModVersionList({ modSlug, versions, isUploader = false }: ModVersionListProps) {
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString();
    };

    const handleDownload = async (version: ModVersion) => {
        setDownloading(prev => new Set(prev).add(version.versionId));
        setDownloadError(null);
        
        try {
            await downloadVersion(modSlug, version.versionId, version.fileName || `mod-${modSlug}-v${version.version}.jar`);
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
            {versions.map((version) => (
                <VersionCard key={version.versionId}>
                    <VersionInfo>
                        <VersionHeader>
                            <VersionNumber>v{version.version}</VersionNumber>
                            <VersionDate>{formatDate(version.createdAt)}</VersionDate>
                        </VersionHeader>
                        {version.changelog && <Changelog>{version.changelog}</Changelog>}
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
                        </Meta>
                        {version.sha256 && (
                            <IntegrityBadge 
                                slug={modSlug}
                                versionId={version.versionId}
                                showCopyButton={isUploader}
                            />
                        )}
                    </VersionInfo>
                    <DownloadButton
                        onClick={() => handleDownload(version)}
                        disabled={downloading.has(version.versionId)}
                    >
                        {downloading.has(version.versionId) ? 'Downloading...' : 'Download'}
                    </DownloadButton>
                </VersionCard>
            ))}
        </Container>
    );
}

