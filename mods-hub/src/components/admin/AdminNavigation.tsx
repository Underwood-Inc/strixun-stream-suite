/**
 * Admin Navigation Component
 * 
 * Tab-style navigation for admin pages
 * Provides consistent navigation across all admin interfaces
 */

import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const NavContainer = styled.nav`
  background: ${colors.bgSecondary};
  border-bottom: 2px solid ${colors.border};
  padding: 0 ${spacing.xl};
  margin: 0 -${spacing.xl} ${spacing.lg} -${spacing.xl};
  display: flex;
  gap: ${spacing.sm};
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: ${colors.border} transparent;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${colors.border};
    border-radius: 2px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: ${colors.borderLight};
  }
`;

const Tab = styled.button<{ active: boolean }>`
  padding: ${spacing.md} ${spacing.lg};
  background: none;
  border: none;
  border-bottom: 3px solid ${props => props.active ? colors.accent : 'transparent'};
  color: ${props => props.active ? colors.accent : colors.textSecondary};
  font-size: 0.875rem;
  font-weight: ${props => props.active ? 600 : 500};
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: -2px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: ${spacing.xs};
  position: relative;
  
  &:hover {
    color: ${props => props.active ? colors.accent : colors.text};
    background: ${props => props.active ? 'transparent' : `${colors.bgTertiary}40`};
  }
  
  &:active {
    transform: translateY(1px);
  }
  
  &:focus-visible {
    outline: 2px solid ${colors.accent};
    outline-offset: -2px;
    border-radius: 4px 4px 0 0;
  }
`;

const TabIcon = styled.span`
  font-size: 1rem;
  line-height: 1;
`;

interface AdminTab {
  path: string;
  label: string;
  icon?: string;
}

const adminTabs: AdminTab[] = [
  { path: '/admin', label: 'Mod Triage', icon: '[PACKAGE]' },
  { path: '/admin/users', label: 'User Management', icon: '[USERS]' },
  { path: '/admin/r2', label: 'R2 Management', icon: '[EMOJI]' },
  { path: '/admin/settings', label: 'Settings', icon: '[SETTINGS]' },
];

export function AdminNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleTabClick = (path: string) => {
    navigate(path);
  };
  
  return (
    <NavContainer>
      {adminTabs.map((tab) => {
        const isActive = location.pathname === tab.path || 
          (tab.path === '/admin' && location.pathname.startsWith('/admin') && 
           location.pathname !== '/admin/users' && location.pathname !== '/admin/r2');
        
        return (
          <Tab
            key={tab.path}
            active={isActive}
            onClick={() => handleTabClick(tab.path)}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.icon && <TabIcon>{tab.icon}</TabIcon>}
            {tab.label}
          </Tab>
        );
      })}
    </NavContainer>
  );
}

