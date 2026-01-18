/**
 * FooterContainer - Atomic footer component for layout/styling (React)
 * Provides consistent footer styling (background, padding, border)
 * 
 * @param children - Footer content
 * @param className - Optional CSS class
 */

import React from 'react';

interface FooterContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const FooterContainer: React.FC<FooterContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <footer 
      className={className}
      style={{
        background: 'var(--bg-dark, #1a1611)',
        borderTop: '1px solid var(--border, #3e3e3e)',
        padding: 'var(--spacing-xl, 2rem)',
        marginTop: 'var(--spacing-3xl, 4rem)',
      }}
    >
      {children}
    </footer>
  );
};
