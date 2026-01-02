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
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { getButtonStyles } from '../utils/buttonStyles';
import { getCardStyles } from '../utils/sharedStyles';

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
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  font-size: 1rem;
`;

export function ModDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { data, isLoading, error } = useModDetail(slug || '');
    const { user, isAuthenticated } = useAuthStore();
    const isUploader = user?.userId === data?.mod.authorId;
    const [thumbnailError, setThumbnailError] = useState(false);
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

    const handleThumbnailError = () => {
        setThumbnailError(true);
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
            await downloadVersion(slug, latestVersion.versionId, fileName);
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
                            <ErrorIcon>⚠</ErrorIcon>
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
                                onClick={handleDownloadLatest}
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

