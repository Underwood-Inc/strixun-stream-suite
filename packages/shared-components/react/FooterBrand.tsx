/**
 * FooterBrand - Atomic footer component for brand/service name (React)
 * 
 * @param serviceName - Name of the service (e.g., "OTP Authentication API")
 * @param description - Optional description/tagline
 * @param className - Optional CSS class
 */

import React from 'react';

interface FooterBrandProps {
  serviceName: string;
  description?: string;
  className?: string;
}

export const FooterBrand: React.FC<FooterBrandProps> = ({ 
  serviceName, 
  description, 
  className = '' 
}) => {
  return (
    <div className={className} style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary, #b8b8b8)', fontSize: '1rem', margin: 0 }}>
        {serviceName}
      </p>
      {description && (
        <p style={{ 
          color: 'var(--text-muted, #888)', 
          fontSize: '0.875rem', 
          margin: 'var(--spacing-sm, 0.5rem) 0 0 0' 
        }}>
          {description}
        </p>
      )}
    </div>
  );
};
