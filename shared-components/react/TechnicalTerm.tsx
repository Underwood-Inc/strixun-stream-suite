/**
 * TechnicalTerm Component - React
 * 
 * Wrapper for technical terms with dotted underline and informative tooltips.
 * Matches the design pattern from otp-auth-service for consistent UX across the suite.
 * 
 * Features:
 * - Dotted underline to indicate hoverable term
 * - Rich tooltip with technical explanation
 * - Optional external links (specs, documentation, source code)
 * - Semantic HTML with proper accessibility
 * - Consistent styling matching otp-auth patterns
 * 
 * @example
 * <TechnicalTerm
 *   term="RBAC"
 *   definition="Role-Based Access Control - A method of regulating access to resources based on the roles of individual users within an organization."
 *   link="https://en.wikipedia.org/wiki/Role-based_access_control"
 * >
 *   RBAC
 * </TechnicalTerm>
 * 
 * @example
 * <TechnicalTerm
 *   term="JWT"
 *   definition="JSON Web Token - A compact, URL-safe means of representing claims to be transferred between two parties."
 *   link="https://datatracker.ietf.org/doc/html/rfc7519"
 *   sourceLink="https://github.com/Underwood-Inc/strixun-stream-suite/blob/main/serverless/access-service/utils/auth.ts"
 * >
 *   JWT
 * </TechnicalTerm>
 */

import React, { ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import styled from 'styled-components';

export interface TechnicalTermProps {
  /** The term being explained (used as tooltip title) */
  term: string;
  /** Detailed explanation of the term */
  definition: string;
  /** Optional external link (spec, documentation, Wikipedia) */
  link?: string;
  /** Optional source code link (GitHub) */
  sourceLink?: string;
  /** The text to display (defaults to term) */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

const TermWrapper = styled.span`
  color: var(--accent, #edae49);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  cursor: help;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    color: var(--accent-light, #f9df74);
    text-decoration-color: var(--accent-light, #f9df74);
  }
`;

const TooltipContent = styled.div`
  text-align: left;
  
  h3 {
    margin: 0 0 10px 0;
    color: var(--accent, #edae49);
    font-size: 1rem;
    font-weight: 600;
  }
  
  p {
    margin: 0 0 12px 0;
    color: var(--text-secondary, #b8b8b8);
    font-size: 0.875rem;
    line-height: 1.6;
  }
  
  .links {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.2));
  }
  
  .link-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    
    a {
      color: var(--info, #6495ed);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
      
      &:hover {
        color: var(--accent-light, #f9df74);
        text-decoration: underline;
      }
    }
    
    .icon {
      flex-shrink: 0;
      font-size: 0.75rem;
      opacity: 0.7;
    }
  }
`;

export function TechnicalTerm({ 
  term, 
  definition, 
  link, 
  sourceLink,
  children,
  className = ''
}: TechnicalTermProps) {
  const tooltipContent = (
    <TooltipContent>
      <h3>{term}</h3>
      <p>{definition}</p>
      {(link || sourceLink) && (
        <div className="links">
          {link && (
            <div className="link-item">
              <span className="icon">→</span>
              <a href={link} target="_blank" rel="noopener noreferrer">
                View Specification
              </a>
            </div>
          )}
          {sourceLink && (
            <div className="link-item">
              <span className="icon">⊕</span>
              <a href={sourceLink} target="_blank" rel="noopener noreferrer">
                View Source Code
              </a>
            </div>
          )}
        </div>
      )}
    </TooltipContent>
  );
  
  return (
    <Tooltip
      content={tooltipContent}
      position="auto"
      interactive={true}
      maxWidth="400px"
      level="info"
    >
      <TermWrapper className={`technical-term ${className}`}>
        {children || term}
      </TermWrapper>
    </Tooltip>
  );
}

export default TechnicalTerm;
