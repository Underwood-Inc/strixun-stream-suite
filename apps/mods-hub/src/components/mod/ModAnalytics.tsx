/**
 * Mod Analytics Component
 * Shows analytics for a mod (views, downloads over time)
 */

import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata, ModVersion, ModVariant } from '../../types/mod';
import { getCardStyles } from '../../utils/sharedStyles';

const Container = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${spacing.md};
`;

const StatCard = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.accent};
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
`;

const VersionStats = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`;

const VersionStatItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${spacing.sm};
  background: ${colors.bgTertiary};
  border-radius: 4px;
`;

const VersionLabel = styled.span`
  font-size: 0.875rem;
  color: ${colors.text};
  font-weight: 500;
`;

const VersionDownloads = styled.span`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
`;

interface ModAnalyticsProps {
    mod: ModMetadata;
    versions: ModVersion[];
    variants?: ModVariant[];
}

export function ModAnalytics({ mod, versions, variants = [] }: ModAnalyticsProps) {
    // Calculate total downloads from versions
    const totalVersionDownloads = versions.reduce((sum, v) => sum + v.downloads, 0);
    
    // Calculate total downloads from variants (use totalDownloads field)
    const totalVariantDownloads = variants.reduce((sum, v) => sum + (v.totalDownloads || 0), 0);
    
    // Total cumulative downloads (should match mod.downloadCount)
    const calculatedTotal = totalVersionDownloads + totalVariantDownloads;
    
    const versionCount = versions.length;
    const variantCount = variants.length;
    
    // Calculate average downloads per version (including variants in the calculation)
    const avgDownloadsPerVersion = versionCount > 0 ? Math.round(totalVersionDownloads / versionCount) : 0;
    
    // Get top versions by downloads
    // Note: Variants don't have version field anymore, they're separate entities with their own versions
    const topVersions = versions
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5);

    return (
        <Container>
            <Title>Analytics</Title>
            
            <StatsGrid>
                <StatCard>
                    <StatValue>{mod.downloadCount.toLocaleString()}</StatValue>
                    <StatLabel>Total Downloads</StatLabel>
                    {calculatedTotal !== mod.downloadCount && (
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: spacing.xs }}>
                            (Calculated: {calculatedTotal.toLocaleString()})
                        </div>
                    )}
                </StatCard>
                <StatCard>
                    <StatValue>{versionCount}</StatValue>
                    <StatLabel>Versions</StatLabel>
                </StatCard>
                {variantCount > 0 && (
                    <StatCard>
                        <StatValue>{variantCount}</StatValue>
                        <StatLabel>Variants</StatLabel>
                    </StatCard>
                )}
                <StatCard>
                    <StatValue>{avgDownloadsPerVersion.toLocaleString()}</StatValue>
                    <StatLabel>Avg Downloads/Version</StatLabel>
                </StatCard>
                <StatCard>
                    <StatValue>{new Date(mod.createdAt).toLocaleDateString()}</StatValue>
                    <StatLabel>Created</StatLabel>
                </StatCard>
            </StatsGrid>

            {topVersions.length > 0 && (
                <VersionStats>
                    <Title style={{ fontSize: '1rem', marginBottom: spacing.xs }}>Top Versions by Downloads</Title>
                    {topVersions.map((version) => (
                        <VersionStatItem key={version.versionId}>
                            <VersionLabel>v{version.version}</VersionLabel>
                            <VersionDownloads>{version.downloads.toLocaleString()} downloads</VersionDownloads>
                        </VersionStatItem>
                    ))}
                </VersionStats>
            )}
        </Container>
    );
}

