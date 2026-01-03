/**
 * User Dashboard Page
 * Shows user's mods with management options
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModsList, useDeleteMod } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import { ModCard } from '../components/mod/ModCard';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import type { ModMetadata } from '../types/mod';
import { getButtonStyles } from '../utils/buttonStyles';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Button = styled.button`
  ${getButtonStyles('primary')}
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.accentHover};
  }
`;

const ModsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 320px));
  grid-auto-flow: row dense;
  gap: ${spacing.lg};
  align-items: start;
  justify-items: stretch;
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

const EmptyState = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textSecondary};
`;

const EmptyStateTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${colors.text};
  margin-bottom: ${spacing.md};
`;

const EmptyStateMessage = styled.p`
  color: ${colors.textSecondary};
  margin-bottom: ${spacing.lg};
`;

export function UserDashboardPage() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();
    const [modToDelete, setModToDelete] = useState<ModMetadata | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const { data, isLoading, error } = useModsList({
        page: 1,
        pageSize: 100,
        authorId: user?.userId,
    });

    const deleteMod = useDeleteMod();

    const handleDeleteClick = (mod: ModMetadata) => {
        setModToDelete(mod);
        setIsModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!modToDelete) return;
        
        try {
            // Use slug if available (preferred), otherwise fall back to modId
            const identifier = modToDelete.slug || modToDelete.modId;
            await deleteMod.mutateAsync(identifier);
            setModToDelete(null);
            setIsModalOpen(false);
        } catch {
            // Error is handled by the mutation
            // Don't close modal on error so user can retry
        }
    };

    const handleModalClose = () => {
        if (!deleteMod.isPending) {
            setIsModalOpen(false);
            setModToDelete(null);
        }
    };

    if (!isAuthenticated || !user) {
        return (
            <PageContainer>
                <Error>Please log in to view your dashboard.</Error>
            </PageContainer>
        );
    }

    if (isLoading) return <Loading>Loading your mods...</Loading>;
    if (error) return <Error>Failed to load mods: {(error as Error).message}</Error>;

    const mods = data?.mods || [];

    return (
        <PageContainer>
            <Header>
                <Title>My Mods</Title>
                <Button onClick={() => navigate('/upload')}>
                    Upload New Mod
                </Button>
            </Header>

            {mods.length === 0 ? (
                <EmptyState>
                    <EmptyStateTitle>No mods yet</EmptyStateTitle>
                    <EmptyStateMessage>
                        You haven&apos;t uploaded any mods yet. Get started by uploading your first mod!
                    </EmptyStateMessage>
                    <Button onClick={() => navigate('/upload')}>
                        Upload Your First Mod
                    </Button>
                </EmptyState>
            ) : (
                <ModsGrid>
                    {mods.map((mod) => (
                        <ModCard 
                            key={mod.modId} 
                            mod={mod} 
                            onDelete={handleDeleteClick}
                            showDelete={true}
                        />
                    ))}
                </ModsGrid>
            )}

            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onConfirm={handleDeleteConfirm}
                title="Delete Mod"
                message={`Are you sure you want to delete "${modToDelete?.title}"? This action cannot be undone and will permanently delete the mod and all its versions from everywhere.`}
                confirmText="Delete Mod"
                cancelText="Cancel"
                isLoading={deleteMod.isPending}
            />
        </PageContainer>
    );
}

