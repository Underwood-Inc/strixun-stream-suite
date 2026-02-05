/**
 * RichTextEditor Preview Styles
 * Preview container for rendered HTML
 */

import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

export const PreviewContainer = styled.div`
  padding: ${spacing.md};
  min-height: 150px;
  max-height: 500px;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${colors.text};
  
  h1, h2, h3, h4, h5, h6 { 
    color: ${colors.text}; 
    margin: ${spacing.md} 0 ${spacing.sm} 0; 
    font-weight: 600; 
  }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.125rem; }
  
  p { margin: ${spacing.sm} 0; }
  
  ul, ol { padding-left: ${spacing.lg}; margin: ${spacing.sm} 0; }
  li { margin: ${spacing.xs} 0; }
  
  code {
    background: ${colors.bgTertiary};
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-size: 0.8125rem;
    color: ${colors.accent};
  }
  
  pre {
    background: ${colors.bgTertiary};
    padding: ${spacing.md};
    border-radius: 4px;
    overflow-x: auto;
  }
  
  blockquote {
    border-left: 3px solid ${colors.accent};
    padding-left: ${spacing.md};
    margin: ${spacing.md} 0;
    color: ${colors.textMuted};
    font-style: italic;
  }
  
  a { color: ${colors.accent}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  
  strong { font-weight: 600; }
  em { font-style: italic; }
  
  hr {
    border: none;
    border-top: 1px solid ${colors.border};
    margin: ${spacing.md} 0;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
    margin: ${spacing.md} 0;
  }
  
  th, td {
    border: 1px solid ${colors.border};
    padding: ${spacing.xs} ${spacing.sm};
    text-align: left;
  }
  
  th {
    background: ${colors.bgTertiary};
    font-weight: 600;
  }
  
  img {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
    margin: ${spacing.sm} 0;
  }
`;
