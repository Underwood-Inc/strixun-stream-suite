/**
 * Header component
 */

import { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, type AuthStore } from '../../stores/auth';
import { useUploadPermission } from '../../hooks/useUploadPermission';
import { useDrafts } from '../../hooks/useMods';
import { colors, spacing, media } from '../../theme';
import { getButtonStyles } from '../../utils/buttonStyles';
import { Tooltip } from '@strixun/shared-components/react';
import type { TooltipTheme } from '@strixun/shared-components/react';
import { useShallow } from 'zustand/react/shallow';

// Theme configuration for shared Tooltip component
const tooltipTheme: TooltipTheme = {
  colors: {
    bg: colors.bg,
    card: colors.card,
    bgTertiary: colors.bgTertiary,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    border: colors.border,
    accent: colors.accent,
    info: colors.info,
    warning: colors.warning,
    danger: colors.danger,
  },
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
  },
};

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
  
  ${media.mobile} {
    padding: ${spacing.sm} ${spacing.md};
  }
`;

const Logo = styled(Link)`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.accent};
  text-decoration: none;
  flex-shrink: 0;
  
  &:hover {
    color: ${colors.accentHover};
  }
  
  ${media.mobile} {
    font-size: 1.25rem;
  }
`;

const Nav = styled.nav<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing.lg};
  
  ${media.mobile} {
    position: fixed;
    top: 57px; /* Header height on mobile */
    right: 0;
    width: 280px;
    max-width: 80vw;
    height: calc(100vh - 57px);
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    background: ${colors.bgSecondary};
    border-left: 1px solid ${colors.border};
    padding: ${spacing.md};
    transform: translateX(${props => props.$isOpen ? '0' : '100%'});
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow-y: auto;
    box-shadow: ${props => props.$isOpen ? '-4px 0 12px rgba(0, 0, 0, 0.3)' : 'none'};
  }
`;

const NavLink = styled(Link)`
  color: ${colors.textSecondary};
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
  
  &:hover {
    color: ${colors.text};
  }
  
  ${media.mobile} {
    padding: ${spacing.md};
    border-bottom: 1px solid ${colors.border};
    
    &:hover {
      background: ${colors.bgTertiary};
    }
  }
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
  
  ${media.mobile} {
    width: 100%;
    justify-content: center;
  }
`;

const LogoutButton = styled(Button)`
  max-width: 250px;
  overflow: hidden;
  
  ${media.mobile} {
    max-width: 100%;
    margin-top: auto;
  }
`;

const HamburgerButton = styled.button`
  display: none;
  background: transparent;
  border: none;
  color: ${colors.text};
  font-size: 1.5rem;
  cursor: pointer;
  padding: ${spacing.sm};
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${colors.bgTertiary};
    border-radius: 4px;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  ${media.mobile} {
    display: flex;
  }
`;

const MobileOverlay = styled.div<{ $isOpen: boolean }>`
  display: none;
  
  ${media.mobile} {
    display: block;
    position: fixed;
    top: 57px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
    opacity: ${props => props.$isOpen ? 1 : 0};
    pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.lg};
  
  ${media.mobile} {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    width: 100%;
  }
`;

export function Header() {
    // Use shallow comparison selector to prevent unnecessary re-renders
    // This ensures the component updates when session is restored
    const { customer, isAuthenticated, isSuperAdmin, logout } = useAuthStore(
        useShallow((state: AuthStore) => ({
            customer: state.customer,
            isAuthenticated: state.isAuthenticated,
            isSuperAdmin: state.isSuperAdmin,
            logout: state.logout,
        }))
    );
    
    // Mobile menu state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const { hasPermission } = useUploadPermission();
    const { data: draftsData } = useDrafts();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
        setIsMobileMenuOpen(false);
    };
    
    const handleNavClick = () => {
        setIsMobileMenuOpen(false);
    };
    
    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };
    
    // Close mobile menu on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
            }
        };
        
        if (isMobileMenuOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    // Check if customer has any drafts
    const hasDrafts = isAuthenticated && (draftsData?.mods?.some(mod => mod.status === 'draft') || false);

    return (
        <>
            <HeaderContainer>
                <Logo to="/" onClick={handleNavClick}>Mods Hub</Logo>
                <HamburgerButton 
                    onClick={toggleMobileMenu}
                    aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={isMobileMenuOpen}
                >
                    {isMobileMenuOpen ? '✕' : '☰'}
                </HamburgerButton>
                <Nav $isOpen={isMobileMenuOpen}>
                    <NavLink to="/" onClick={handleNavClick}>Browse</NavLink>
                    {isAuthenticated ? (
                        <NavActions>
                            {hasPermission && (
                                <>
                                    <NavLink to="/upload" onClick={handleNavClick}>Upload</NavLink>
                                    <NavLink to="/dashboard" onClick={handleNavClick}>My Mods</NavLink>
                                    {hasDrafts && (
                                        <NavLink to="/drafts" onClick={handleNavClick} style={{ color: colors.warning }}>
                                            Drafts ({draftsData?.mods?.filter(m => m.status === 'draft').length || 0})
                                        </NavLink>
                                    )}
                                </>
                            )}
                            <NavLink to="/profile" onClick={handleNavClick}>Profile</NavLink>
                            {isSuperAdmin && (
                                <NavLink to="/admin" onClick={handleNavClick}>Admin</NavLink>
                            )}
                            <Tooltip 
                                text={`Logout (${customer?.displayName || 'Customer'})`} 
                                detectTruncation 
                                position="bottom"
                                theme={tooltipTheme}
                            >
                                <LogoutButton $variant="secondary" onClick={handleLogout}>
                                    <span style={{ 
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Logout ({customer?.displayName || 'Customer'})
                                    </span>
                                </LogoutButton>
                            </Tooltip>
                        </NavActions>
                    ) : (
                        <Button $variant="primary" onClick={() => { navigate('/login'); handleNavClick(); }}>
                            Login
                        </Button>
                    )}
                </Nav>
            </HeaderContainer>
            <MobileOverlay $isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
        </>
    );
}

