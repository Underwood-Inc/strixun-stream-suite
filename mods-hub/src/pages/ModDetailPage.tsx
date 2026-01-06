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
  
  /* Responsive: Stack vertically on mobile */
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const ThumbnailContainer = styled.div`
  width: 200px;
  height: 200px; /* Explicit height to match 1:1 aspect ratio */
  flex-shrink: 0;
  /* Fixed size - InteractiveThumbnail has aspect-ratio: 1, making it square */
  
  /* Responsive: Larger on tablets, smaller on mobile */
  @media (max-width: 1024px) and (min-width: 769px) {
    width: 180px;
    height: 180px;
  }
  
  @media (max-width: 768px) {
    width: 280px;
    height: 280px;
    max-width: 90vw;
    max-height: 90vw;
  }
  
  @media (max-width: 480px) {
    width: 240px;
    height: 240px;
  }
`;

const Info = styled.div`
  ${getCardStyles('default')}
  flex: 1;
  min-width: 0; /* Allow flex shrinking and prevent overflow */
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  min-height: 200px; /* Minimum height to prevent collapsing */
  align-self: stretch; /* Match height of container */
  
  /* Responsive: Full width on mobile */
  @media (max-width: 768px) {
    width: 100%;
    min-height: auto;
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  line-height: 1.6;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const Meta = styled.div`
  display: flex;
  gap: ${spacing.lg};
  flex-wrap: wrap;
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

