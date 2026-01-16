/**
 * MarkdownContent component
 * Renders markdown content with styled output
 * Uses react-markdown for parsing
 */

import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const MarkdownContainer = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  line-height: 1.6;
  
  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    color: ${colors.text};
    margin: ${spacing.md} 0 ${spacing.sm} 0;
    font-weight: 600;
  }
  
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1.125rem; }
  h3 { font-size: 1rem; }
  h4, h5, h6 { font-size: 0.875rem; }
  
  /* Paragraphs */
  p {
    margin: ${spacing.sm} 0;
  }
  
  /* Lists */
  ul, ol {
    padding-left: ${spacing.lg};
    margin: ${spacing.sm} 0;
  }
  
  li {
    margin: ${spacing.xs} 0;
  }
  
  /* Code */
  code {
    background: ${colors.bgTertiary};
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.8125rem;
    color: ${colors.accent};
  }
  
  pre {
    background: ${colors.bgTertiary};
    padding: ${spacing.md};
    border-radius: 4px;
    overflow-x: auto;
    margin: ${spacing.sm} 0;
  }
  
  pre code {
    background: none;
    padding: 0;
  }
  
  /* Links */
  a {
    color: ${colors.accent};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  /* Blockquotes */
  blockquote {
    border-left: 3px solid ${colors.accent};
    padding-left: ${spacing.md};
    margin: ${spacing.md} 0;
    color: ${colors.textMuted};
    font-style: italic;
  }
  
  /* Horizontal rules */
  hr {
    border: none;
    border-top: 1px solid ${colors.border};
    margin: ${spacing.md} 0;
  }
  
  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: ${spacing.md} 0;
  }
  
  th, td {
    border: 1px solid ${colors.border};
    padding: ${spacing.sm};
    text-align: left;
  }
  
  th {
    background: ${colors.bgTertiary};
    font-weight: 600;
  }
  
  /* Strong/Bold */
  strong {
    color: ${colors.text};
    font-weight: 600;
  }
  
  /* Images */
  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }
`;

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <MarkdownContainer className={className}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </MarkdownContainer>
  );
}
