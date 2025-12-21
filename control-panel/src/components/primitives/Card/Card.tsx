import { type ReactNode, useState } from 'react';
import styled, { css } from 'styled-components';
import { colors, radii, spacing, fontSizes, fontWeights, transitions } from '@/theme/tokens';

export interface CardProps {
  title?: string;
  icon?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
  className?: string;
}

const CardWrapper = styled.div`
  background: ${colors.card};
  border: 1px solid ${colors.border};
  border-radius: ${radii.lg};
  margin-bottom: ${spacing.lg};
  overflow: hidden;
`;

const CardHeader = styled.div<{ $collapsible: boolean; $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: ${spacing.md} ${spacing.lg};
  border-bottom: 1px solid ${({ $collapsed }) => $collapsed ? 'transparent' : colors.border};
  transition: border-color ${transitions.normal};
  
  ${({ $collapsible }) => $collapsible && css`
    cursor: pointer;
    user-select: none;
    
    &:hover {
      background: ${colors.bgDark};
    }
  `}
`;

const CardTitle = styled.h3`
  font-size: ${fontSizes.sm};
  font-weight: ${fontWeights.semibold};
  color: ${colors.muted};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
`;

const CardIcon = styled.span`
  font-size: 1.1em;
`;

const CollapseIcon = styled.span<{ $collapsed: boolean }>`
  font-size: 0.8em;
  color: ${colors.muted};
  transition: transform ${transitions.normal};
  transform: rotate(${({ $collapsed }) => $collapsed ? '-90deg' : '0'});
`;

const CardContent = styled.div<{ $collapsed: boolean }>`
  padding: ${spacing.lg};
  display: ${({ $collapsed }) => $collapsed ? 'none' : 'block'};
`;

/**
 * Card container component with optional title and collapsible behavior.
 */
export function Card({
  title,
  icon,
  collapsible = false,
  defaultCollapsed = false,
  children,
  className,
}: CardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  
  const handleToggle = () => {
    if (collapsible) {
      setCollapsed(!collapsed);
    }
  };
  
  return (
    <CardWrapper className={className}>
      {title && (
        <CardHeader
          $collapsible={collapsible}
          $collapsed={collapsed}
          onClick={handleToggle}
        >
          {icon && <CardIcon>{icon}</CardIcon>}
          <CardTitle>{title}</CardTitle>
          {collapsible && <CollapseIcon $collapsed={collapsed}>▼</CollapseIcon>}
        </CardHeader>
      )}
      <CardContent $collapsed={collapsible && collapsed}>
        {children}
      </CardContent>
    </CardWrapper>
  );
}

