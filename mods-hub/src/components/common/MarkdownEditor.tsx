/**
 * MarkdownEditor component
 * Rich markdown editor with live preview
 * Uses @uiw/react-md-editor for editing
 */

import MDEditor from '@uiw/react-md-editor';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

// Override editor styles to match our theme
const EditorContainer = styled.div`
  /* Base editor styling */
  .w-md-editor {
    background: ${colors.bgSecondary};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    color: ${colors.text};
    box-shadow: none;
  }
  
  /* Toolbar */
  .w-md-editor-toolbar {
    background: ${colors.bgTertiary};
    border-bottom: 1px solid ${colors.border};
    padding: ${spacing.xs} ${spacing.sm};
  }
  
  .w-md-editor-toolbar li > button {
    color: ${colors.textSecondary};
    
    &:hover {
      background: ${colors.bgSecondary};
      color: ${colors.accent};
    }
    
    &:disabled {
      color: ${colors.textMuted};
    }
  }
  
  .w-md-editor-toolbar-divider {
    background: ${colors.border};
  }
  
  /* Text area */
  .w-md-editor-text-input,
  .w-md-editor-text-pre > code,
  .w-md-editor-text-pre {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    color: ${colors.text} !important;
  }
  
  .w-md-editor-text {
    padding: ${spacing.md};
  }
  
  .w-md-editor-input {
    color: ${colors.text};
    caret-color: ${colors.accent};
  }
  
  /* Preview pane */
  .w-md-editor-preview {
    background: ${colors.bg};
    padding: ${spacing.md};
  }
  
  .wmde-markdown {
    background: transparent;
    color: ${colors.textSecondary};
    font-size: 0.875rem;
    line-height: 1.6;
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: ${colors.text};
      border-bottom: none;
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
      color: ${colors.text};
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
      background: transparent;
    }
    
    /* Horizontal rules */
    hr {
      border: none;
      border-top: 1px solid ${colors.border};
      margin: ${spacing.md} 0;
      background: transparent;
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
  }
  
  /* Divider between edit and preview */
  .w-md-editor-content {
    border: none;
  }
  
  /* Full screen mode */
  .w-md-editor-fullscreen {
    z-index: 10000;
  }
  
  /* Placeholder */
  .w-md-editor-text-input::placeholder {
    color: ${colors.textMuted};
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${colors.text};
  margin-bottom: ${spacing.xs};
`;

const HelpText = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
  margin-left: ${spacing.sm};
  font-weight: 400;
`;

interface MarkdownEditorProps {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Optional label */
  label?: string;
  /** Optional placeholder */
  placeholder?: string;
  /** Editor height in pixels */
  height?: number;
  /** Show preview by default */
  preview?: 'edit' | 'live' | 'preview';
  /** Hide toolbar */
  hideToolbar?: boolean;
  /** Additional class name */
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder = 'Write your content in markdown...',
  height = 300,
  preview = 'live',
  hideToolbar = false,
  className,
}: MarkdownEditorProps) {
  return (
    <EditorContainer className={className} data-color-mode="dark">
      {label && (
        <Label>
          {label}
          <HelpText>Supports markdown formatting</HelpText>
        </Label>
      )}
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview={preview}
        hideToolbar={hideToolbar}
        textareaProps={{
          placeholder,
          // Disable browser extensions (Grammarly, etc.) that cause text doubling
          // @ts-expect-error - data attributes are valid HTML but not typed in ITextAreaProps
          'data-gramm': 'false',
          'data-gramm_editor': 'false',
          'data-enable-grammarly': 'false',
          autoComplete: 'off',
          autoCorrect: 'off',
          autoCapitalize: 'off',
          spellCheck: false,
        }}
      />
    </EditorContainer>
  );
}
