/**
 * Mod Review Page
 * Shows mod details with review comments and status management
 * Only accessible to admins and the mod uploader
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useModReview, useAddReviewComment, useUpdateModStatus } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import styled from 'styled-components';
import { colors, spacing } from '../theme/index';
import type { ModStatus } from '../types/mod';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles, getCardStyles } from '../utils/sharedStyles';
import { getStatusBadgeType } from '../utils/badgeHelpers';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: ${spacing.lg};
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

const StatusBadge = styled.span<{ status: ModStatus }>`
  ${({ status }) => getBadgeStyles(getStatusBadgeType(status))}
  font-size: 0.875rem;
`;

const Section = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const CommentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Comment = styled.div<{ isAdmin: boolean }>`
  padding: ${spacing.md};
  background: ${props => props.isAdmin ? `${colors.accent}10` : colors.bgTertiary};
  border-left: 3px solid ${props => props.isAdmin ? colors.accent : colors.border};
  border-radius: 4px;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.sm};
`;

const CommentAuthor = styled.span`
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const CommentDate = styled.span`
  color: ${colors.textMuted};
  font-size: 0.75rem;
`;

const CommentContent = styled.p`
  color: ${colors.textSecondary};
  margin: 0;
  line-height: 1.6;
`;

const CommentForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const TextArea = styled.textarea`
  padding: ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-family: inherit;
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatusActions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  flex-wrap: wrap;
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

export function ModReviewPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [commentText, setCommentText] = useState('');

    const { data, isLoading, error } = useModReview(slug || '');
    const addComment = useAddReviewComment();
    const updateStatus = useUpdateModStatus();
    const { isSuperAdmin, user } = useAuthStore();

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !data) return;
        await addComment.mutateAsync({ modId: data.mod.modId, content: commentText.trim() });
        setCommentText('');
    };

    // Redirect if user doesn't have permission (not admin and not uploader)
    useEffect(() => {
        if (!isLoading && data) {
            const { mod } = data;
            const isAdmin = isSuperAdmin || false;
            const isUploader = user?.userId === mod.authorId;
            
            if (!isAdmin && !isUploader) {
                navigate('/', { replace: true });
            }
        }
    }, [isLoading, data, isSuperAdmin, user, navigate]);

    if (isLoading) return <Loading>Loading review...</Loading>;
    if (error) {
        // If error is 403 or 404, redirect to home
        if (error instanceof Error && (error.message.includes('403') || error.message.includes('404'))) {
            navigate('/', { replace: true });
            return null;
        }
        return <Error>Failed to load review: {(error as Error).message}</Error>;
    }
    if (!data) {
        navigate('/', { replace: true });
        return null;
    }

    const { mod } = data;
    const isAdmin = isSuperAdmin || false;
    const isUploader = user?.userId === mod.authorId;

    // Final check - redirect if still no permission (shouldn't happen due to useEffect, but safety check)
    if (!isAdmin && !isUploader) {
        navigate('/', { replace: true });
        return null;
    }

    // CRITICAL: For non-admin users (uploaders), customerId is required for review operations
    if (!isAdmin && !user?.customerId) {
        return (
            <Error>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <h2>Customer Account Required</h2>
                    <p>Your account is missing a customer association. This is required for review operations.</p>
                    <p>Please contact support or try logging out and back in to refresh your account information.</p>
                </div>
            </Error>
        );
    }

    return (
        <PageContainer>
            <Header>
                <Info>
                    <Title>{mod.title}</Title>
                    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
                        <StatusBadge status={mod.status}>{mod.status}</StatusBadge>
                        <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>
                            By {mod.authorDisplayName || 'Unknown User'}
                        </span>
                    </div>
                </Info>
                {(isAdmin || isUploader) && (
                    <StatusActions>
                        {isAdmin && (
                            <>
                                <Button
                                    $variant="primary"
                                    onClick={() => updateStatus.mutateAsync({ modId: mod.modId, status: 'approved' })}
                                    disabled={updateStatus.isPending || mod.status === 'approved'}
                                >
                                    Approve
                                </Button>
                                <Button
                                    onClick={() => updateStatus.mutateAsync({ modId: mod.modId, status: 'changes_requested' })}
                                    disabled={updateStatus.isPending || mod.status === 'changes_requested'}
                                >
                                    Request Changes
                                </Button>
                                <Button
                                    $variant="danger"
                                    onClick={() => updateStatus.mutateAsync({ modId: mod.modId, status: 'denied' })}
                                    disabled={updateStatus.isPending || mod.status === 'denied'}
                                >
                                    Deny
                                </Button>
                            </>
                        )}
                    </StatusActions>
                )}
            </Header>

            <Section>
                <SectionTitle>Description</SectionTitle>
                <p style={{ color: colors.textSecondary, lineHeight: 1.6 }}>{mod.description}</p>
            </Section>

            <Section>
                <SectionTitle>Review Comments</SectionTitle>
                <CommentList>
                    {mod.reviewComments && mod.reviewComments.length > 0 ? (
                        mod.reviewComments.map((comment: { commentId: string; isAdmin: boolean; authorDisplayName?: string | null; content: string; createdAt: string }) => (
                            <Comment key={comment.commentId} isAdmin={comment.isAdmin}>
                                <CommentHeader>
                                    <CommentAuthor>
                                        {comment.isAdmin ? '★ Admin' : (comment.authorDisplayName || 'Unknown User')}
                                    </CommentAuthor>
                                    <CommentDate>
                                        {new Date(comment.createdAt).toLocaleString()}
                                    </CommentDate>
                                </CommentHeader>
                                <CommentContent>{comment.content}</CommentContent>
                            </Comment>
                        ))
                    ) : (
                        <p style={{ color: colors.textMuted }}>No comments yet</p>
                    )}
                </CommentList>

                <CommentForm onSubmit={handleSubmitComment}>
                    <TextArea
                        value={commentText}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        required
                    />
                    <Button type="submit" disabled={addComment.isPending || !commentText.trim()}>
                        {addComment.isPending ? 'Posting...' : 'Post Comment'}
                    </Button>
                </CommentForm>
            </Section>

            {mod.statusHistory && mod.statusHistory.length > 0 && (
                <Section>
                    <SectionTitle>Status History</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                        {mod.statusHistory.map((entry: { status: ModStatus; changedAt: string; changedBy: string; changedByDisplayName?: string | null; reason?: string }, index: number) => (
                            <div key={index} style={{ padding: spacing.sm, background: colors.bgTertiary, borderRadius: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                                    <StatusBadge status={entry.status}>{entry.status}</StatusBadge>
                                    <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                                        {new Date(entry.changedAt).toLocaleString()} by {entry.changedByDisplayName || entry.changedBy || 'Unknown User'}
                                    </span>
                                </div>
                                {entry.reason && (
                                    <p style={{ color: colors.textSecondary, fontSize: '0.875rem', margin: 0 }}>
                                        {entry.reason}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}
        </PageContainer>
    );
}

