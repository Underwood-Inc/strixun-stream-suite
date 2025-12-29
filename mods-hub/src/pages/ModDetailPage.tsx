/**
 * Mod detail page
 * Shows mod information, versions, and download options
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useModDetail, useModRatings, useSubmitModRating } from '../hooks/useMods';
import { ModVersionList } from '../components/mod/ModVersionList';
import { ModAnalytics } from '../components/mod/ModAnalytics';
import { ModRatings } from '../components/mod/ModRatings';
import { IntegrityBadge } from '../components/mod/IntegrityBadge';
import { ModMetaTags } from '../components/MetaTags';
import { useAuthStore } from '../stores/auth';
import { downloadVersion } from '../services/api';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  gap: ${spacing.lg};
`;

const Thumbnail = styled.img`
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid ${colors.border};
`;

const ThumbnailError = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 8px;
  border: 2px dashed ${colors.warning || colors.accent}40;
  background: ${colors.bgTertiary};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${spacing.md};
  text-align: center;
  color: ${colors.textSecondary};
`;

const ErrorIcon = styled.div`
  font-size: 2rem;
  margin-bottom: ${spacing.xs};
  opacity: 0.7;
`;

const ErrorMessage = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${colors.warning || colors.accent};
  margin-bottom: ${spacing.xs};
`;

const ErrorDetail = styled.div`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  line-height: 1.4;
`;

const Info = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  line-height: 1.6;
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.lg};
  color: ${colors.textMuted};
  font-size: 0.875rem;
`;

const Tags = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
`;

const Tag = styled.span`
  background: ${colors.bgSecondary};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.75rem;
  color: ${colors.textSecondary};
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

const Actions = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: center;
  margin-top: ${spacing.md};
`;

const DownloadButton = styled.button`
  padding: ${spacing.md} ${spacing.lg};
  background: ${colors.accent};
  color: ${colors.bg};
  border: none;
  border-radius: 4px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export function ModDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data, isLoading, error } = useModDetail(slug || '');
    const { user } = useAuthStore();
    const isUploader = user?.userId === data?.mod.authorId;
    const [thumbnailError, setThumbnailError] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    
    // Fetch ratings for this mod
    const { data: ratingsData } = useModRatings(data?.mod.modId || '');
    const submitRating = useSubmitModRating();

    if (isLoading) return <Loading>Loading mod...</Loading>;
    if (error) return <Error>Failed to load mod: {(error as Error).message}</Error>;
    if (!data) return <Error>Mod not found</Error>;

    const { mod, versions } = data;
    const latestVersion = versions[0]; // Versions are sorted newest first
    
    const handleRatingSubmit = async (rating: number, comment: string) => {
        await submitRating.mutateAsync({
            modId: mod.modId,
            rating,
            comment: comment || undefined,
        });
    };

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    const handleDownload = async () => {
        if (!latestVersion) return;
        
        setDownloading(true);
        setDownloadError(null);
        
        try {
            await downloadVersion(mod.slug, latestVersion.versionId, latestVersion.fileName || `mod-${mod.slug}-v${latestVersion.version}.jar`);
        } catch (error: any) {
            console.error('[ModDetailPage] Download failed:', error);
            setDownloadError(error.message || 'Failed to download file');
            setTimeout(() => setDownloadError(null), 5000);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <ModMetaTags mod={mod} />
            <PageContainer>
                <Header>
                {mod.thumbnailUrl ? (
                    thumbnailError ? (
                        <ThumbnailError>
                            <ErrorIcon>[WARNING]</ErrorIcon>
                            <ErrorMessage>Thumbnail unavailable</ErrorMessage>
                            <ErrorDetail>Image failed to load</ErrorDetail>
                        </ThumbnailError>
                    ) : (
                        <Thumbnail 
                            src={mod.thumbnailUrl} 
                            alt={mod.title}
                            onError={handleThumbnailError}
                        />
                    )
                ) : null}
                <Info>
                    <Title>{mod.title}</Title>
                    <Description>{mod.description}</Description>
                    <Meta>
                        <span>By {mod.authorDisplayName || 'Unknown User'}</span>
                        <span>•</span>
                        <span>{mod.downloadCount} downloads</span>
                        <span>•</span>
                        <span>Latest: {mod.latestVersion}</span>
                        <span>•</span>
                        <span>Updated: {new Date(mod.updatedAt).toLocaleDateString()}</span>
                        {latestVersion?.sha256 && (
                            <>
                                <span>•</span>
                                <IntegrityBadge 
                                    slug={mod.slug}
                                    versionId={latestVersion.versionId}
                                    showCopyButton={isUploader}
                                />
                            </>
                        )}
                    </Meta>
                    <Tags>
                        {mod.tags.map((tag: string) => (
                            <Tag key={tag}>{tag}</Tag>
                        ))}
                    </Tags>
                    {latestVersion && (
                        <Actions>
                            {downloadError && (
                                <div style={{ 
                                    padding: spacing.sm, 
                                    background: `${colors.danger}20`, 
                                    color: colors.danger, 
                                    borderRadius: 4,
                                    fontSize: '0.875rem'
                                }}>
                                    {downloadError}
                                </div>
                            )}
                            <DownloadButton
                                onClick={handleDownload}
                                disabled={downloading}
                            >
                                {downloading ? 'Downloading...' : `Download Latest Version (v${latestVersion.version})`}
                            </DownloadButton>
                        </Actions>
                    )}
                </Info>
            </Header>

            <ModVersionList modSlug={mod.slug} versions={versions} isUploader={isUploader} />
            
            {isUploader && (
                <ModAnalytics mod={mod} versions={versions} />
            )}
            
            <ModRatings 
                modId={mod.modId}
                ratings={ratingsData?.ratings || []}
                averageRating={ratingsData?.average}
                onRatingSubmit={handleRatingSubmit}
            />
            </PageContainer>
        </>
    );
}

