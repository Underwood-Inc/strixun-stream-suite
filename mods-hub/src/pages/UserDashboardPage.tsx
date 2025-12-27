/**
 * User Dashboard Page
 * Shows user's mods with management options
 */

import { useNavigate } from 'react-router-dom';
import { useModsList } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import { ModCard } from '../components/mod/ModCard';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

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
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.accent};
  color: ${colors.bg};
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.accentHover};
  }
`;

const ModsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${spacing.lg};
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
    
    const { data, isLoading, error } = useModsList({
        page: 1,
        pageSize: 100,
        authorId: user?.userId,
    });

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
                        You haven't uploaded any mods yet. Get started by uploading your first mod!
                    </EmptyStateMessage>
                    <Button onClick={() => navigate('/upload')}>
                        Upload Your First Mod
                    </Button>
                </EmptyState>
            ) : (
                <ModsGrid>
                    {mods.map((mod) => (
                        <ModCard key={mod.modId} mod={mod} />
                    ))}
                </ModsGrid>
            )}
        </PageContainer>
    );
}

