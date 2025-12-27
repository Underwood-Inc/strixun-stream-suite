/**
 * Mod detail page
 * Shows mod information, versions, and download options
 */

import { useParams } from 'react-router-dom';
import { useModDetail } from '../hooks/useMods';
import { ModVersionList } from '../components/mod/ModVersionList';
import { IntegrityBadge } from '../components/mod/IntegrityBadge';
import { useAuthStore } from '../stores/auth';
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

export function ModDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data, isLoading, error } = useModDetail(slug || '');
    const { user } = useAuthStore();
    const isUploader = user && data?.mod.authorId === user.userId;

    if (isLoading) return <Loading>Loading mod...</Loading>;
    if (error) return <Error>Failed to load mod: {(error as Error).message}</Error>;
    if (!data) return <Error>Mod not found</Error>;

    const { mod, versions } = data;
    const latestVersion = versions[0]; // Versions are sorted newest first

    return (
        <PageContainer>
            <Header>
                {mod.thumbnailUrl && <Thumbnail src={mod.thumbnailUrl} alt={mod.title} />}
                <Info>
                    <Title>{mod.title}</Title>
                    <Description>{mod.description}</Description>
                    <Meta>
                        <span>By {mod.authorEmail}</span>
                        <span>•</span>
                        <span>{mod.downloadCount} downloads</span>
                        <span>•</span>
                        <span>Latest: {mod.latestVersion}</span>
                        {latestVersion?.sha256 && (
                            <>
                                <span>•</span>
                                <IntegrityBadge 
                                    modId={mod.modId} 
                                    versionId={latestVersion.versionId}
                                    showCopyButton={isUploader}
                                />
                            </>
                        )}
                    </Meta>
                    <Tags>
                        {mod.tags.map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                        ))}
                    </Tags>
                </Info>
            </Header>

            <ModVersionList modId={mod.modId} versions={versions} isUploader={isUploader} />
        </PageContainer>
    );
}

