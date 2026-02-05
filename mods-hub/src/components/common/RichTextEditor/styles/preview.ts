/**
 * RichTextEditor Preview Styles
 * Preview container for rendered HTML
 */

import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

export const PreviewContainer = styled.div`
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
  
  .carousel-preview {
    display: flex;
    gap: ${spacing.sm};
    flex-wrap: wrap;
    padding: ${spacing.sm} 0;
    margin: ${spacing.sm} 0;
    border: 1px solid ${colors.border};
    border-radius: 4px;
    padding: ${spacing.sm};
    background: ${colors.bgSecondary};
    
    img {
      max-width: 200px;
      max-height: 150px;
      border-radius: 4px;
      object-fit: cover;
      margin: 0;
    }
  }
  
  /* Collapsible sections */
  .Collapsible__container,
  details.Collapsible__container {
    background: ${colors.bgTertiary};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    margin: ${spacing.xs} 0;
    
    &:not([open]) {
      padding-bottom: 0;
    }
  }
  
  .Collapsible__title,
  summary.Collapsible__title {
    cursor: pointer;
    padding: ${spacing.xs} ${spacing.sm} ${spacing.xs} ${spacing.md};
    position: relative;
    font-weight: 600;
    font-size: 0.875rem;
    list-style: none;
    outline: none;
    color: ${colors.text};
    
    &::marker,
    &::-webkit-details-marker {
      display: none;
    }
    
    &::before {
      content: '';
      position: absolute;
      left: ${spacing.xs};
      top: 50%;
      transform: translateY(-50%);
      border-style: solid;
      border-color: transparent;
      border-width: 4px 0 4px 5px;
      border-left-color: ${colors.textSecondary};
      transition: transform 0.2s ease;
    }
  }
  
  .Collapsible__container[open] > .Collapsible__title::before,
  details.Collapsible__container[open] > .Collapsible__title::before,
  div.Collapsible__container[open] > .Collapsible__title::before {
    transform: translateY(-50%) rotate(90deg);
  }
  
  .Collapsible__content {
    padding: 0 ${spacing.sm} ${spacing.xs} ${spacing.md};
    
    &[hidden] {
      display: none;
    }
    
    > *:first-child {
      margin-top: 0;
    }
    
    > *:last-child {
      margin-bottom: 0;
    }
  }
`;
