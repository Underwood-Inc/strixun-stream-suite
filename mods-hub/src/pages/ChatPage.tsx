/**
 * Chat Page
 * 
 * P2P chat interface for mods-hub users
 */

import styled from 'styled-components';
import { ChatClient } from '@strixun/chat/react';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { colors, spacing } from '../theme';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  min-height: 500px;
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

const WipBadge = styled.span`
  padding: 4px 12px;
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid ${colors.warning};
  border-radius: 4px;
  color: ${colors.warning};
  font-size: 0.75rem;
  font-weight: 600;
`;

const ChatContainer = styled.div`
  flex: 1;
  min-height: 0;
  background: ${colors.card};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

const AuthRequired = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: ${spacing.md};
  color: ${colors.textSecondary};
  text-align: center;
  padding: ${spacing.xl};
`;

const AuthTitle = styled.h2`
  color: ${colors.text};
  margin: 0;
  font-size: 1.25rem;
`;

export function ChatPage() {
  const { customer, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !customer) {
    return (
      <PageContainer>
        <PageHeader>
          <Title>Community Chat</Title>
          <WipBadge>Beta</WipBadge>
        </PageHeader>
        <ChatContainer>
          <AuthRequired>
            <AuthTitle>Authentication Required</AuthTitle>
            <p>Please log in to access the community chat.</p>
          </AuthRequired>
        </ChatContainer>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <Title>Community Chat</Title>
        <WipBadge>Beta</WipBadge>
      </PageHeader>
      <ChatContainer>
        <ChatClient
          useChatStore={useChatStore}
          userId={customer.customerId}
          userName={customer.displayName || 'Customer'}
          showRoomList={true}
          showRoomCreator={true}
          style={{ height: '100%' }}
        />
      </ChatContainer>
    </PageContainer>
  );
}
