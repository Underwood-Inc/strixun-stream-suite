/**
 * Main layout component
 */

import { useEffect } from 'react';
import styled from 'styled-components';
import { Header } from './Header';
import { NotificationContainer } from './NotificationContainer';
import { useAuthStore } from '../../stores/auth';
import { colors, spacing } from '../../theme';

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${colors.bg};
`;

const MainContent = styled.main`
  flex: 1;
  padding: ${spacing.xl};
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
`;

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { restoreSession, user } = useAuthStore();

    // Restore session from backend on mount
    // This enables cross-application session sharing for the same device
    // Always try to restore - it will check if restoration is needed
    useEffect(() => {
        restoreSession().catch(error => {
            console.debug('[Layout] Session restoration failed (non-critical):', error);
        });
    }, []); // Only run once on mount

    return (
        <LayoutContainer>
            <Header />
            <MainContent>
                {children}
            </MainContent>
            <NotificationContainer />
        </LayoutContainer>
    );
}

