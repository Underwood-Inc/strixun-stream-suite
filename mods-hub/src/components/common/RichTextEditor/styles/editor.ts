/**
 * RichTextEditor Content Styles
 * Content editable area and placeholder
 */

import styled from 'styled-components';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { colors, spacing } from '../../../../theme';

export const Placeholder = styled.div`
  position: absolute;
  /* Account for ContentEditable padding (${spacing.md}) plus paragraph top margin (${spacing.sm}) */
  top: calc(${spacing.md} + ${spacing.sm});
  left: ${spacing.md};
  right: ${spacing.md};
  color: ${colors.textMuted};
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const StyledContentEditable = styled(ContentEditable)`
  min-height: 150px;
  height: 100%;
  overflow-y: auto;
  padding: ${spacing.md};
  outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${colors.text};
  position: relative;
  z-index: 1;
  
  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    color: ${colors.text};
    margin: ${spacing.md} 0 ${spacing.sm} 0;
    font-weight: 600;
  }
  
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.125rem; }
  h4 { font-size: 1rem; }
  h5 { font-size: 0.9375rem; }
  h6 { font-size: 0.875rem; }
  
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
  
  /* Checklist */
  ul[data-lexical-list-type="check"] {
    list-style: none;
    padding-left: 0;
    
    li {
      display: flex;
      align-items: flex-start;
      gap: ${spacing.xs};
      
      &::before {
        content: '';
        width: 16px;
        height: 16px;
        border: 2px solid ${colors.border};
        border-radius: 3px;
        flex-shrink: 0;
        margin-top: 2px;
      }
      
      &[aria-checked="true"]::before {
        background: ${colors.accent};
        border-color: ${colors.accent};
      }
    }
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
    
    code {
      background: transparent;
      padding: 0;
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
  
  /* Links */
  a {
    color: ${colors.accent};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  /* Strong/Bold */
  strong {
    color: ${colors.text};
    font-weight: 600;
  }
  
  /* Emphasis */
  em {
    font-style: italic;
  }
  
  /* Underline */
  u {
    text-decoration: underline;
  }
  
  /* Strikethrough */
  s {
    text-decoration: line-through;
  }
  
  /* Subscript/Superscript */
  sub {
    font-size: 0.75em;
    vertical-align: sub;
  }
  
  sup {
    font-size: 0.75em;
    vertical-align: super;
  }
  
  /* Highlight/Mark */
  mark {
    background: ${colors.warning}40;
    padding: 0 0.125rem;
    border-radius: 2px;
  }
  
  /* Hashtags */
  .hashtag {
    color: ${colors.accent};
    font-weight: 500;
  }
  
  /* Horizontal Rule */
  hr {
    border: none;
    border-top: 1px solid ${colors.border};
    margin: ${spacing.md} 0;
  }
  
  /* Tables */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: ${spacing.md} 0;
    
    th, td {
      border: 1px solid ${colors.border};
      padding: ${spacing.xs} ${spacing.sm};
      text-align: left;
    }
    
    th {
      background: ${colors.bgTertiary};
      font-weight: 600;
    }
  }
  
  /* Inline images */
  img {
    max-width: 100%;
    max-height: 300px;
    border-radius: 4px;
    margin: ${spacing.sm} 0;
  }
  
  /* Embedded videos */
  iframe {
    max-width: 100%;
    border-radius: 4px;
    margin: ${spacing.sm} 0;
  }
  
  /* Collapsible sections */
  .Collapsible__container {
    background: ${colors.bgTertiary};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    margin: ${spacing.xs} 0;
  }
  
  .Collapsible__title {
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
  div.Collapsible__container[open] > .Collapsible__title::before {
    transform: translateY(-50%) rotate(90deg);
  }
  
  /* Content hidden when collapsed */
  .Collapsible__content {
    display: none;
    padding: ${spacing.xs} ${spacing.sm} ${spacing.sm} ${spacing.md};
  }
  
  /* Content visible when open */
  .Collapsible__container[open] > .Collapsible__content,
  div.Collapsible__container[open] > .Collapsible__content {
    display: block;
  }
`;
