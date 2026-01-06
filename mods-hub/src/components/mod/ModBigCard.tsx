/**
 * Big card view component for mods
 * Displays mods in a large, prominent card format
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import type { ModMetadata } from '../../types/mod';
import { getCardStyles } from '../../utils/sharedStyles';
import { InteractiveThumbnail } from './InteractiveThumbnail';

const CardContainer = styled.div`
  ${getCardStyles('hover')}
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  text-decoration: none;
  color: inherit;
  flex: 1;
`;

const ThumbnailWrapper = styled.div`
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
`;

const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  flex: 1;
`;

const CardLink = styled(Link)`
  text-decoration: none;
  color: inherit;
  
  &:hover {
    text-decoration: none;
  }
`;

const Title = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Author = styled.div`
  font-size: 0.875rem;
  color: ${colors.textMuted};
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
`;

const AuthorLabel = styled.span`
  font-weight: 500;
  color: ${colors.textSecondary};
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
`;

const Meta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: ${spacing.sm};
  border-top: 1px solid ${colors.border};
  margin-top: auto;
`;

const MetaLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
  font-size: 0.875rem;
  color: ${colors.textMuted};
`;

const DownloadCount = styled.span`
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  
  &::before {
    content: '⬇';
    font-size: 0.875rem;
  }
`;

const Category = styled.span`
  background: ${colors.accent}20;
  color: ${colors.accent};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: capitalize;
`;

interface ModBigCardProps {
    mod: ModMetadata;
}

export function ModBigCard({ mod }: ModBigCardProps) {
    const [thumbnailError, setThumbnailError] = useState(false);

    const handleThumbnailError = () => {
        setThumbnailError(true);
    };

    return (
        <CardContainer>
            <Card>
                <ThumbnailWrapper>
                    {mod.thumbnailUrl && !thumbnailError ? (
                        <InteractiveThumbnail 
                            mod={mod}
                            onError={handleThumbnailError}
                        />
                    ) : (
                        <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: colors.textSecondary,
                            fontSize: '0.875rem',
                            padding: spacing.md,
                            border: `2px dashed ${colors.border}`,
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: spacing.xs, opacity: 0.7 }}>📦</div>
                            <div>No thumbnail</div>
                        </div>
                    )}
                </ThumbnailWrapper>
                <CardContent>
                    <CardLink to={`/${mod.slug}`}>
                        <Title>{mod.title}</Title>
                        <Author>
                            <AuthorLabel>by</AuthorLabel>
                            <span>{mod.authorDisplayName || 'Unknown Author'}</span>
                        </Author>
                        <Description>{mod.description || 'No description available'}</Description>
                    </CardLink>
                    <Meta>
                        <MetaLeft>
                            <DownloadCount>{mod.downloadCount.toLocaleString()}</DownloadCount>
                        </MetaLeft>
                        <Category>{mod.category}</Category>
                    </Meta>
                </CardContent>
            </Card>
        </CardContainer>
    );
}
