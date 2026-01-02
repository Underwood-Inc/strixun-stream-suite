/**
 * Mod detail page
 * Shows mod information, versions, and download options
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useModDetail, useModRatings, useSubmitModRating } from '../hooks/useMods';
import { ModVersionList } from '../components/mod/ModVersionList';
import { ModAnalytics } from '../components/mod/ModAnalytics';
import { ModRatings } from '../components/mod/ModRatings';
import { IntegrityBadge } from '../components/mod/IntegrityBadge';
import { ModMetaTags } from '../components/MetaTags';
import { useAuthStore } from '../stores/auth';
import { downloadVersion } from '../services/api';
import { getUserFriendlyErrorMessage, shouldRedirectToLogin } from '../utils/error-messages';
import { celebrateClick } from '../utils/confetti';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { getButtonStyles } from '../utils/buttonStyles';
import { getCardStyles } from '../utils/sharedStyles';
import { candyShopAnimation } from '../utils/candyShopAnimation';
import { InteractiveThumbnail } from '../components/mod/InteractiveThumbnail';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  gap: ${spacing.lg};
`;

const ThumbnailContainer = styled.div`
  width: 200px;
  flex-shrink: 0;
  /* InteractiveThumbnail has aspect-ratio: 16/9, so height will be calculated */
`;

const Info = styled.div`
  ${getCardStyles('default')}
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

const ManageButton = styled.button`
  ${getButtonStyles('secondary')}
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  font-size: 1rem;
`;

const DownloadButton = styled.button`
  ${getButtonStyles('primary')}
  ${candyShopAnimation}
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  font-size: 1rem;
`;

export function ModDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { data, isLoading, error, refetch } = useModDetail(slug || '');
    const { user, isAuthenticated } = useAuthStore();
    const isUploader = user?.userId === data?.mod.authorId;
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    
    // Fetch ratings for this mod
    const { data: ratingsData } = useModRatings(data?.mod.modId || '');
    const submitRating = useSubmitModRating();

    if (isLoading) return <Loading>Loading mod...</Loading>;
    if (error) {
        const friendlyMessage = getUserFriendlyErrorMessage(error);
        return <Error>{friendlyMessage}</Error>;
    }
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


    const handleDownloadLatest = async () => {
        if (!latestVersion || !slug) return;
        
        // SECURITY: Prevent unauthenticated download attempts
        if (!isAuthenticated) {
            setDownloadError('Please log in to download files');
            setTimeout(() => {
                setDownloadError(null);
                navigate('/login');
            }, 2000);
            return;
        }
        
        setDownloading(true);
        setDownloadError(null);
        
        try {
            const fileName = latestVersion.fileName || `mod-${slug}-v${latestVersion.version}.jar`;
            // PESSIMISTIC UPDATE: Wait for download to complete before updating UI
            await downloadVersion(slug, latestVersion.versionId, fileName);
            
            // Download successful - refetch mod data to get updated download counts
            console.log('[ModDetailPage] Download completed, refetching mod data for updated counts');
            await refetch();
        } catch (error) {
            console.error('[ModDetailPage] Download failed:', error);
            setDownloadError(getUserFriendlyErrorMessage(error));
            setTimeout(() => setDownloadError(null), 5000);
            
            // Redirect to login if auth error
            if (shouldRedirectToLogin(error)) {
                setTimeout(() => {
                    navigate('/login');
                }, 1000);
            }
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <ModMetaTags mod={mod} />
            <PageContainer>
                <Header>
                {mod.thumbnailUrl && (
                    <ThumbnailContainer>
                        <InteractiveThumbnail 
                            mod={mod}
                            onNavigate={() => {
                                // Already on detail page, no navigation needed
                            }}
                        />
                    </ThumbnailContainer>
                )}
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
                            {isUploader && (
                                <ManageButton
                                    onClick={() => navigate(`/manage/${mod.slug}`)}
                                >
                                    Manage Mod
                                </ManageButton>
                            )}
                            <DownloadButton
                                onClick={(e) => {
                                    celebrateClick(e.currentTarget);
                                    handleDownloadLatest();
                                }}
                                disabled={downloading || !latestVersion || !isAuthenticated}
                                title={!isAuthenticated ? 'Please log in to download' : undefined}
                            >
                                {downloading ? 'Downloading...' : `Download Latest ${latestVersion.version}`}
                            </DownloadButton>
                            {downloadError && (
                                <span style={{ color: colors.danger, fontSize: '0.875rem' }}>
                                    {downloadError}
                                </span>
                            )}
                        </Actions>
                    )}
                </Info>
            </Header>

            <ModVersionList 
                modSlug={mod.slug} 
                versions={versions} 
                variants={mod.variants || []}
            />
            
            {isUploader && (
                <ModAnalytics mod={mod} versions={versions} variants={mod.variants || []} />
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

