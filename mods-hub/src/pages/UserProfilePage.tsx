/**
 * User Profile Page
 * Shows user information, stats, and account details
 */

import { useModsList } from '../hooks/useMods';
import { useAuthStore } from '../stores/auth';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useNavigate } from 'react-router-dom';
import { getButtonStyles } from '../utils/buttonStyles';
import { getBadgeStyles, getCardStyles } from '../utils/sharedStyles';
import { DisplayNameEditor } from '../components/common/DisplayNameEditor';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const ProfileSection = styled.div`
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

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${spacing.md};
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const InfoLabel = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InfoValue = styled.span`
  font-size: 1rem;
  color: ${colors.text};
  font-weight: 500;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: ${spacing.md};
`;

const StatCard = styled.div`
  ${getCardStyles('default')}
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.accent};
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
`;

const Badge = styled.span<{ $variant?: 'admin' | 'default' }>`
  ${({ $variant }) => getBadgeStyles($variant === 'admin' ? 'accent' : 'default')}
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

const Button = styled.button`
  ${getButtonStyles('primary')}
  
  &:hover {
    background: ${colors.accentHover};
  }
`;

export function UserProfilePage() {
    const { user, isAuthenticated, isSuperAdmin } = useAuthStore();
    const navigate = useNavigate();
    
    const { data: modsData, isLoading: modsLoading } = useModsList({
        page: 1,
        pageSize: 1000, // Get all mods for stats
        authorId: user?.userId,
    });

    if (!isAuthenticated || !user) {
        return (
            <PageContainer>
                <Error>Please log in to view your profile.</Error>
            </PageContainer>
        );
    }

    const mods = modsData?.mods || [];
    const totalDownloads = mods.reduce((sum, mod) => sum + mod.downloadCount, 0);
    const publishedMods = mods.filter(m => m.status === 'published').length;
    const pendingMods = mods.filter(m => m.status === 'pending').length;

    return (
        <PageContainer>
            <Header>
                <Title>My Profile</Title>
                <Button onClick={() => navigate('/dashboard')}>
                    View My Mods
                </Button>
            </Header>

            <ProfileSection>
                <SectionTitle>Account Information</SectionTitle>
                <InfoGrid>
                    <InfoItem style={{ gridColumn: '1 / -1' }}>
                        <InfoLabel>Display Name</InfoLabel>
                        <DisplayNameEditor
                            currentDisplayName={user.displayName}
                            onUpdate={async (newDisplayName) => {
                                // Update the user in the auth store
                                const { setUser } = useAuthStore.getState();
                                setUser({
                                    ...user,
                                    displayName: newDisplayName,
                                });
                                // Refresh user info to get latest from server
                                await useAuthStore.getState().fetchUserInfo();
                            }}
                            apiEndpoint="/user/display-name"
                            authToken={user.token}
                        />
                    </InfoItem>
                    <InfoItem>
                        <InfoLabel>User ID</InfoLabel>
                        <InfoValue style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {user.userId}
                        </InfoValue>
                    </InfoItem>
                    <InfoItem>
                        <InfoLabel>Account Type</InfoLabel>
                        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
                            <InfoValue>Standard User</InfoValue>
                            {isSuperAdmin && (
                                <Badge $variant="admin">Super Admin</Badge>
                            )}
                        </div>
                    </InfoItem>
                </InfoGrid>
            </ProfileSection>

            <ProfileSection>
                <SectionTitle>Statistics</SectionTitle>
                {modsLoading ? (
                    <Loading>Loading statistics...</Loading>
                ) : (
                    <StatsGrid>
                        <StatCard>
                            <StatValue>{mods.length}</StatValue>
                            <StatLabel>Total Mods</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{publishedMods}</StatValue>
                            <StatLabel>Published</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{pendingMods}</StatValue>
                            <StatLabel>Pending Review</StatLabel>
                        </StatCard>
                        <StatCard>
                            <StatValue>{totalDownloads.toLocaleString()}</StatValue>
                            <StatLabel>Total Downloads</StatLabel>
                        </StatCard>
                    </StatsGrid>
                )}
            </ProfileSection>

            <ProfileSection>
                <SectionTitle>Quick Actions</SectionTitle>
                <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
                    <Button onClick={() => navigate('/upload')}>
                        Upload New Mod
                    </Button>
                    <Button onClick={() => navigate('/dashboard')}>
                        Manage My Mods
                    </Button>
                    {isSuperAdmin && (
                        <Button onClick={() => navigate('/admin')}>
                            Admin Panel
                        </Button>
                    )}
                </div>
            </ProfileSection>
        </PageContainer>
    );
}

