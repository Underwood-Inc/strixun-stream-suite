/**
 * Header component
 */

import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useUploadPermission } from '../../hooks/useUploadPermission';
import { useDrafts } from '../../hooks/useMods';
import { colors, spacing } from '../../theme';

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

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${spacing.sm} ${spacing.md};
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  
  ${({ variant = 'primary' }) => 
    variant === 'primary' 
      ? `
        background: ${colors.accent};
        color: ${colors.bg};
        
        &:hover {
          background: ${colors.accentHover};
        }
      `
      : `
        background: transparent;
        color: ${colors.text};
        border: 1px solid ${colors.border};
        
        &:hover {
          border-color: ${colors.borderLight};
        }
      `
  }
`;

export function Header() {
    const { isAuthenticated, user, logout, isSuperAdmin } = useAuthStore();
    const { hasPermission } = useUploadPermission();
    const { data: draftsData } = useDrafts();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Check if user has any drafts
    const hasDrafts = isAuthenticated && draftsData?.mods?.some(mod => mod.status === 'draft') || false;

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
                        <Button variant="secondary" onClick={handleLogout}>
                            Logout ({user?.email})
                        </Button>
                    </>
                ) : (
                    <Button variant="primary" onClick={() => navigate('/login')}>
                        Login
                    </Button>
                )}
            </Nav>
        </HeaderContainer>
    );
}

