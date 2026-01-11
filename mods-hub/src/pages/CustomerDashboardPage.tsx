/**
 * Customer Dashboard Page
 * Shows customer's mods with management options
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import { useModsList, useDeleteMod } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import { ModCard } from '../components/mod/ModCard';
import { ModListItem } from '../components/mod/ModListItem';
import { ViewToggle, type ViewType } from '../components/mod/ViewToggle';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import type { ModMetadata } from '../types/mod';
import { getButtonStyles } from '../utils/buttonStyles';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
  width: 100%;
  height: calc(100vh - 200px);
  min-height: 600px;
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  flex-shrink: 0;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${spacing.md};
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

const ListContainer = styled.div`
  flex: 1;
  min-height: 0;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

const ModsGrid = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${spacing.md};
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  grid-auto-flow: row dense;
  gap: ${spacing.lg};
  align-items: start;
  justify-items: stretch;
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 8px;
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

const EndOfListIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${spacing.xl} ${spacing.lg};
  color: ${colors.textMuted};
  font-size: 0.875rem;
  background: ${colors.bgSecondary};
  border-top: 1px solid ${colors.border};
  font-style: italic;
`;

const VIEW_STORAGE_KEY = 'mods-dashboard-view';

export function CustomerDashboardPage() {
    const navigate = useNavigate();
    const { customer, isAuthenticated } = useAuthStore();
    const [modToDelete, setModToDelete] = useState<ModMetadata | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [listHeight, setListHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Load view preference from localStorage, default to 'card'
    const [view, setView] = useState<ViewType>(() => {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY);
        return (stored === 'list' || stored === 'card') ? stored : 'card';
    });
    
    // Persist view preference to localStorage
    const handleViewChange = (newView: ViewType) => {
        setView(newView);
        localStorage.setItem(VIEW_STORAGE_KEY, newView);
    };
    
    const { data, isLoading, error } = useModsList({
        page: 1,
        pageSize: 100,
        authorId: customer?.customerId,
    });

    const deleteMod = useDeleteMod();

    // Calculate list height based on available space
    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const availableHeight = window.innerHeight - rect.top - 100;
                setListHeight(Math.max(400, availableHeight));
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

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
            // Don't close modal on error so customer can retry
        }
    };

    const handleModalClose = () => {
        if (!deleteMod.isPending) {
            setIsModalOpen(false);
            setModToDelete(null);
        }
    };

    if (!isAuthenticated || !customer) {
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
        <PageContainer ref={containerRef}>
            <Header>
                <HeaderRow>
                    <Title>My Mods</Title>
                    <HeaderActions>
                        <ViewToggle view={view} onViewChange={handleViewChange} />
                        <Button onClick={() => navigate('/upload')}>
                            Upload New Mod
                        </Button>
                    </HeaderActions>
                </HeaderRow>
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
            ) : view === 'list' ? (
                <ListContainer>
                    <List
                        height={listHeight}
                        itemCount={mods.length + 1}
                        itemSize={110}
                        width="100%"
                    >
                        {({ index, style }) => {
                            if (index === mods.length) {
                                return (
                                    <div style={{ ...style, paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
                                        <EndOfListIndicator>
                                            End of mods list — no more mods to display
                                        </EndOfListIndicator>
                                    </div>
                                );
                            }
                            return (
                                <div style={style}>
                                    <ModListItem mod={mods[index]} />
                                </div>
                            );
                        }}
                    </List>
                </ListContainer>
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
                    <div key="end-of-list" style={{ 
                        gridColumn: '1 / -1', 
                        padding: `${spacing.xl} ${spacing.lg}`,
                        textAlign: 'center',
                        color: colors.textMuted,
                        fontSize: '0.875rem',
                        fontStyle: 'italic',
                        background: colors.bgSecondary,
                        borderTop: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        marginTop: spacing.md,
                        position: 'relative',
                        zIndex: 10
                    }}>
                        End of mods list — no more mods to display
                    </div>
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

