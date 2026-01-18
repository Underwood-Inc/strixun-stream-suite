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
import { FooterContainer, FooterBrand } from '../../../../shared-components/react';
import StrixunSuiteLink from '../../../../shared-components/react/StrixunSuiteLink';

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
    const { checkAuth } = useAuthStore();

    // Check authentication status on mount (HttpOnly cookie SSO)
    // HttpOnly cookie is automatically sent with /auth/me request
    // Note: This is a secondary call - App.tsx also calls checkAuth on initialization
    // The Zustand adapter handles deduplication to prevent concurrent calls
    useEffect(() => {
        checkAuth().catch(() => {
            // Non-critical - user may not be logged in
        });
    }, [checkAuth]); // Only run once on mount

    return (
        <LayoutContainer>
            <Header />
            <MainContent>
                {children}
            </MainContent>
            <FooterContainer>
                <FooterBrand
                    serviceName="Mods Hub"
                    description="Community-driven mod distribution platform"
                />
                <div style={{ textAlign: 'center', margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary, #b8b8b8)' }}>
                    Part of the <StrixunSuiteLink />
                </div>
                <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted, #888)' }}>
                    &copy; {new Date().getFullYear()} Strixun. All rights reserved.
                </div>
            </FooterContainer>
            <NotificationContainer />
        </LayoutContainer>
    );
}

