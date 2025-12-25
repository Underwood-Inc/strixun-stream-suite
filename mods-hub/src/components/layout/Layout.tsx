/**
 * Main layout component
 */

import styled from 'styled-components';
import { Header } from './Header';
import { NotificationContainer } from './NotificationContainer';
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

