/**
 * Header component
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useUploadPermission } from '../../hooks/useUploadPermission';
import { useDrafts } from '../../hooks/useMods';
import { colors, spacing } from '../../theme';
import { getButtonStyles } from '../../utils/buttonStyles';
import { Tooltip } from '../common/Tooltip';

const HeaderContainer = styled.header`
  background: ${colors.bgSecondary};
  border-bottom: 1px solid ${colors.border};
  padding: ${spacing.md} ${spacing.xl};
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.accent};
  text-decoration: none;
  
  &:hover {
    color: ${colors.accentHover};
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: ${spacing.lg};
`;

const NavLink = styled(Link)`
  color: ${colors.textSecondary};
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
  
  &:hover {
    color: ${colors.text};
  }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
`;

const LogoutButton = styled(Button)`
  max-width: 250px;
  overflow: hidden;
`;

export function Header() {
    // Use a single selector to get all auth state at once for better reactivity
    // This ensures the header updates immediately when any auth state changes
    const authState = useAuthStore(state => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isSuperAdmin: state.isSuperAdmin,
        logout: state.logout,
    }));
    
    // Force re-render when auth state changes by subscribing to store changes
    const [, forceUpdate] = useState({});
    useEffect(() => {
        const unsubscribe = useAuthStore.subscribe(() => {
            // Trigger re-render when user or isAuthenticated changes
            forceUpdate({});
        });
        return unsubscribe;
    }, []);
    
    const { user, isAuthenticated, isSuperAdmin, logout } = authState;
    
    const { hasPermission } = useUploadPermission();
    const { data: draftsData } = useDrafts();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Check if user has any drafts
    const hasDrafts = isAuthenticated && (draftsData?.mods?.some(mod => mod.status === 'draft') || false);

    return (
        <HeaderContainer>
            <Logo to="/">Mods Hub</Logo>
            <Nav>
                <NavLink to="/">Browse</NavLink>
                {isAuthenticated ? (
                    <>
                        {hasPermission && (
                            <>
                                <NavLink to="/upload">Upload</NavLink>
                                <NavLink to="/dashboard">My Mods</NavLink>
                                {hasDrafts && (
                                    <NavLink to="/drafts" style={{ color: colors.warning }}>
                                        Drafts ({draftsData?.mods?.filter(m => m.status === 'draft').length || 0})
                                    </NavLink>
                                )}
                            </>
                        )}
                        <NavLink to="/profile">Profile</NavLink>
                        {isSuperAdmin && (
                            <NavLink to="/admin">Admin</NavLink>
                        )}
                        <Tooltip 
                            text={`Logout (${user?.displayName || 'User'})`} 
                            detectTruncation 
                            position="bottom"
                        >
                            <LogoutButton $variant="secondary" onClick={handleLogout}>
                                <span style={{ 
                                    display: 'inline-block',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    Logout ({user?.displayName || 'User'})
                                </span>
                            </LogoutButton>
                        </Tooltip>
                    </>
                ) : (
                    <Button $variant="primary" onClick={() => navigate('/login')}>
                        Login
                    </Button>
                )}
            </Nav>
        </HeaderContainer>
    );
}

