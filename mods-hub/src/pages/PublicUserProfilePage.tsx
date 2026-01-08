/**
 * Public User Profile Page
 * Shows public customer information and their mods
 */

import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
`;

const Username = styled.div`
  font-size: 1.25rem;
  color: ${colors.accent};
  font-weight: 500;
`;

const ProfileSection = styled.div`
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


const Error = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.danger};
`;

const Empty = styled.div`
  text-align: center;
  padding: ${spacing.xxl};
  color: ${colors.textMuted};
`;

export function PublicUserProfilePage() {
    const { username } = useParams<{ username: string }>();
    
    // TODO: Look up user by displayName/username to get userId
    // For now, we'll show a message that this feature is coming soon
    // Once we have an API endpoint to get user by displayName, we can fetch their mods
    
    if (!username) {
        return (
            <PageContainer>
                <Error>Username is required</Error>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <Header>
                <Title>User Profile</Title>
                <Username>@{username}</Username>
            </Header>

            <ProfileSection>
                <SectionTitle>Mods by this user</SectionTitle>
                <Empty>
                    User profile lookup by username is coming soon. 
                    We need to add an API endpoint to look up users by displayName.
                </Empty>
            </ProfileSection>
        </PageContainer>
    );
}

