/**
 * Drafts management page
 * Shows all draft mods for the authenticated user
 */

import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useDrafts, useUpdateModStatus } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import { ModCard } from '../components/mod/ModCard';
import type { ModStatus } from '../types/mod';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles } from '../utils/sharedStyles';
import { getStatusBadgeType } from '../utils/badgeHelpers';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${spacing.xl};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  margin-bottom: ${spacing.lg};
`;

const Description = styled.p`
  color: ${colors.textSecondary};
  margin-bottom: ${spacing.xl};
  font-size: 0.875rem;
`;

const DraftsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${spacing.lg};
  margin-top: ${spacing.lg};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

const EmptyTitle = styled.h2`
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  ${({ variant = 'primary' }) => getButtonStyles(variant)}
  margin: ${spacing.xs};
`;

const StatusBadge = styled.span<{ status: ModStatus }>`
  ${({ status }) => getBadgeStyles(getStatusBadgeType(status))}
`;

const DraftActions = styled.div`
  display: flex;
  gap: ${spacing.sm};
  margin-top: ${spacing.md};
  flex-wrap: wrap;
`;

export function DraftsPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    const { data, isLoading, error } = useDrafts();
    const updateStatus = useUpdateModStatus();

    const handleSubmitForReview = async (modId: string) => {
        try {
            await updateStatus.mutateAsync({ 
                modId, 
                status: 'pending',
                reason: 'Submitted for review by author'
            });
        } catch {
            // Error handled by mutation
        }
    };

    if (!isAuthenticated) {
        return (
            <PageContainer>
                <EmptyState>
                    <EmptyTitle>Authentication Required</EmptyTitle>
                    <p>Please log in to view your drafts.</p>
                </EmptyState>
            </PageContainer>
        );
    }

    if (isLoading) {
        return (
            <PageContainer>
                <Title>My Drafts</Title>
                <Description>Loading drafts...</Description>
            </PageContainer>
        );
    }

    if (error) {
        return (
            <PageContainer>
                <Title>My Drafts</Title>
                <Description style={{ color: colors.danger }}>
                    Error loading drafts. Please try again.
                </Description>
            </PageContainer>
        );
    }

    const drafts = data?.mods.filter(mod => mod.status === 'draft') || [];

    return (
        <PageContainer>
            <Title>My Drafts</Title>
            <Description>
                Manage your draft mods. You can continue editing them or submit them for review when ready.
            </Description>

            {drafts.length === 0 ? (
                <EmptyState>
                    <EmptyTitle>No Drafts</EmptyTitle>
                    <p>You don&apos;t have any draft mods yet.</p>
                    <ActionButton 
                        variant="primary" 
                        onClick={() => navigate('/upload')}
                        style={{ marginTop: spacing.md }}
                    >
                        Create Your First Mod
                    </ActionButton>
                </EmptyState>
            ) : (
                <DraftsGrid>
                    {drafts.map((mod) => (
                        <div key={mod.modId}>
                            <ModCard mod={mod} />
                            <DraftActions>
                                <StatusBadge status={mod.status}>
                                    {mod.status}
                                </StatusBadge>
                                <ActionButton 
                                    variant="secondary"
                                    onClick={() => navigate(`/manage/${mod.slug}`)}
                                >
                                    Edit
                                </ActionButton>
                                <ActionButton 
                                    variant="primary"
                                    onClick={() => handleSubmitForReview(mod.modId)}
                                    disabled={updateStatus.isPending}
                                >
                                    {updateStatus.isPending ? 'Submitting...' : 'Submit for Review'}
                                </ActionButton>
                            </DraftActions>
                        </div>
                    ))}
                </DraftsGrid>
            )}
        </PageContainer>
    );
}

