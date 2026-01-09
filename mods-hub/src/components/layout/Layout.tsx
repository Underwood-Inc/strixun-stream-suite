/**
 * Main layout component
 */

import { useEffect } from 'react';
import styled, { css } from 'styled-components';
import { Header } from './Header';
import { NotificationContainer } from './NotificationContainer';
import { useAuthStore } from '../../stores/auth';
import { colors, spacing, media } from '../../theme';
import { getSeasonalAnimationCSS } from '../../utils/seasonalAnimations';

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${colors.bg};
  
  /* Seasonal background animation */
  ${css`
    ${getSeasonalAnimationCSS(0.4)}
  `}
`;

const MainContent = styled.main`
  flex: 1;
  padding: ${spacing.xl};
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  position: relative;
  z-index: 1; /* Ensure content is above seasonal animation */
  
  ${media.mobile} {
    padding: ${spacing.md};
  }
  
  ${media.tablet} {
    padding: ${spacing.lg};
  }
`;

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { restoreSession } = useAuthStore();

    // Restore session from backend on mount
    // This enables cross-application session sharing for the same device
    // Always try to restore - it will check if restoration is needed
    // Note: This is a secondary call - App.tsx also calls restoreSession on initialization
    // The Zustand adapter handles deduplication to prevent concurrent calls
    useEffect(() => {
        restoreSession().catch(error => {
            console.debug('[Layout] Session restoration failed (non-critical):', error);
        });
    }, [restoreSession]); // Only run once on mount

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

