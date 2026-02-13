/**
 * Chat Page
 * 
 * P2P chat interface for mods-hub users
 * Currently in development - shows coming soon state
 */

import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { getCardStyles } from '../utils/sharedStyles';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 200px);
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${spacing.lg};
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
`;

const ComingSoonContainer = styled.div`
  ${getCardStyles('default')}
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 400px;
  gap: ${spacing.lg};
`;

const ComingSoonIcon = styled.div`
  font-size: 4rem;
  opacity: 0.6;
`;

const ComingSoonTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.text};
  margin: 0;
`;

const ComingSoonDescription = styled.p`
  color: ${colors.textSecondary};
  max-width: 500px;
  line-height: 1.6;
  margin: 0;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${spacing.lg} 0 0 0;
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  text-align: left;
`;

const FeatureItem = styled.li`
  color: ${colors.textMuted};
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  
  &::before {
    content: '✓';
    color: ${colors.accent};
    font-weight: 700;
  }
`;

export function ChatPage() {
  return (
    <PageContainer>
      <PageHeader>
        <Title>Community Chat</Title>
        <span className="coming-soon" style={{ padding: '4px 12px', borderRadius: '4px' }}>
          Coming Soon
        </span>
      </PageHeader>
      
      <ComingSoonContainer className="coming-soon">
        <ComingSoonIcon>💬</ComingSoonIcon>
        <ComingSoonTitle>Coming Soon</ComingSoonTitle>
        <ComingSoonDescription>
          We&apos;re building a peer-to-peer encrypted chat system for the Strixun community. 
          Connect with other mod creators, share ideas, and collaborate in real-time.
        </ComingSoonDescription>
        
        <FeatureList>
          <FeatureItem>End-to-end encrypted messaging</FeatureItem>
          <FeatureItem>Peer-to-peer architecture (no central server storing messages)</FeatureItem>
          <FeatureItem>Create public or private rooms</FeatureItem>
          <FeatureItem>Message integrity verification with hash chains</FeatureItem>
          <FeatureItem>History sync when you reconnect (peers share what you missed)</FeatureItem>
        </FeatureList>
      </ComingSoonContainer>
    </PageContainer>
  );
}
