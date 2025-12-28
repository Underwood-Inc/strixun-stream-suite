/**
 * Mod version list component
 * Displays all versions with download links
 */

import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModVersion } from '../../types/mod';
import { getDownloadUrl } from '../../services/api';
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

const DownloadButton = styled.a`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.accent};
  color: ${colors.bg};
  border-radius: 4px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${colors.accentHover};
  }
`;

interface ModVersionListProps {
    versions: ModVersion[];
    isUploader?: boolean;
}

export function ModVersionList({ versions, isUploader = false }: ModVersionListProps) {
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <Container>
            <Title>Versions ({versions.length})</Title>
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
                                modId={version.modId} 
                                versionId={version.versionId}
                                showCopyButton={isUploader}
                            />
                        )}
                    </VersionInfo>
                    <DownloadButton
                        href={getDownloadUrl(version.modId, version.versionId)}
                        download
                    >
                        Download
                    </DownloadButton>
                </VersionCard>
            ))}
        </Container>
    );
}

