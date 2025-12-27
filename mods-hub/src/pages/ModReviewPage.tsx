/**
 * Mod Review Page
 * Shows mod details with review comments and status management
 * Only accessible to admins and the mod uploader
 */

import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { useModReview, useAddReviewComment, useUpdateModStatus } from '../hooks/useMods';
import styled from 'styled-components';
import { colors, spacing } from '../theme/index';
import type { ModStatus } from '../types/mod';

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
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'published': return `${colors.success}20`;
      case 'approved': return `${colors.success}20`;
      case 'pending': return `${colors.warning}20`;
      case 'changes_requested': return `${colors.warning}20`;
      case 'denied': return `${colors.danger}20`;
      default: return colors.bgTertiary;
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'published': return colors.success;
      case 'approved': return colors.success;
      case 'pending': return colors.warning;
      case 'changes_requested': return colors.warning;
      case 'denied': return colors.danger;
      default: return colors.textSecondary;
    }
  }};
`;

const Section = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.lg};
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

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: ${spacing.sm} ${spacing.md};
  background: ${props => props.variant === 'primary' ? colors.accent : props.variant === 'danger' ? colors.danger : colors.bgSecondary};
  color: ${props => props.variant === 'primary' || props.variant === 'danger' ? '#fff' : colors.text};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  font-weight: 500;
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
    const { user } = useAuthStore();
    const [commentText, setCommentText] = useState('');

    const { data, isLoading, error } = useModReview(slug || '');
    const addComment = useAddReviewComment();
    const updateStatus = useUpdateModStatus();

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !data) return;
        await addComment.mutateAsync({ modId: data.mod.modId, content: commentText.trim() });
        setCommentText('');
    };

    if (isLoading) return <Loading>Loading review...</Loading>;
    if (error) return <Error>Failed to load review: {(error as Error).message}</Error>;
    if (!data) return <Error>Review not found</Error>;

    const { mod } = data;
    const isAdmin = false; // TODO: Check admin status from API

    return (
        <PageContainer>
            <Header>
                <Info>
                    <Title>{mod.title}</Title>
                    <div style={{ display: 'flex', gap: spacing.md, alignItems: 'center' }}>
                        <StatusBadge status={mod.status}>{mod.status}</StatusBadge>
                        <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>
                            By {mod.authorEmail}
                        </span>
                    </div>
                </Info>
                {isAdmin && (
                    <StatusActions>
                        <Button
                            variant="primary"
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
                            variant="danger"
                            onClick={() => updateStatus.mutateAsync({ modId: mod.modId, status: 'denied' })}
                            disabled={updateStatus.isPending || mod.status === 'denied'}
                        >
                            Deny
                        </Button>
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
                        mod.reviewComments.map((comment) => (
                            <Comment key={comment.commentId} isAdmin={comment.isAdmin}>
                                <CommentHeader>
                                    <CommentAuthor>
                                        {comment.isAdmin ? '👑 Admin' : comment.authorEmail}
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
                        onChange={(e) => setCommentText(e.target.value)}
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
                        {mod.statusHistory.map((entry, index) => (
                            <div key={index} style={{ padding: spacing.sm, background: colors.bgTertiary, borderRadius: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                                    <StatusBadge status={entry.status}>{entry.status}</StatusBadge>
                                    <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>
                                        {new Date(entry.changedAt).toLocaleString()} by {entry.changedByEmail || entry.changedBy}
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

