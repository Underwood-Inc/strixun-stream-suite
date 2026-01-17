/**
 * MarkdownEditor component
 * Rich markdown editor using Lexical from Meta
 */

import { useEffect, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $convertToMarkdownString, $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import type { EditorState } from 'lexical';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const EditorContainer = styled.div`
  position: relative;
`;

const EditorWrapper = styled.div<{ $height: number }>`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  min-height: ${props => props.$height}px;
  position: relative;
  
  &:focus-within {
    border-color: ${colors.accent};
    box-shadow: 0 0 0 2px ${colors.accent}20;
  }
`;

const StyledContentEditable = styled(ContentEditable)`
  min-height: 150px;
  padding: ${spacing.md};
  outline: none;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${colors.text};
  
  /* Headings */
  h1, h2, h3, h4, h5, h6 {
    color: ${colors.text};
    margin: ${spacing.md} 0 ${spacing.sm} 0;
    font-weight: 600;
  }
  
  h1 { font-size: 1.25rem; }
  h2 { font-size: 1.125rem; }
  h3 { font-size: 1rem; }
  
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
`;

const Placeholder = styled.div`
  position: absolute;
  top: ${spacing.md};
  left: ${spacing.md};
  color: ${colors.textMuted};
  font-size: 0.875rem;
  pointer-events: none;
  user-select: none;
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

// Toolbar styles
const Toolbar = styled.div`
  display: flex;
  gap: ${spacing.xs};
  padding: ${spacing.xs} ${spacing.sm};
  background: ${colors.bgTertiary};
  border-bottom: 1px solid ${colors.border};
  border-radius: 4px 4px 0 0;
  flex-wrap: wrap;
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
  background: ${props => props.$active ? colors.accent + '20' : 'transparent'};
  border: none;
  color: ${props => props.$active ? colors.accent : colors.textSecondary};
  padding: ${spacing.xs} ${spacing.sm};
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${colors.bgSecondary};
    color: ${colors.accent};
  }
`;

const ToolbarDivider = styled.div`
  width: 1px;
  background: ${colors.border};
  margin: 0 ${spacing.xs};
`;

// Plugin to sync with external value
function ValuePlugin({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  
  // Initialize with value
  useEffect(() => {
    if (value) {
      editor.update(() => {
        $convertFromMarkdownString(value, TRANSFORMERS);
      });
    }
  }, []); // Only on mount
  
  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      onChange(markdown);
    });
  }, [onChange]);
  
  return <OnChangePlugin onChange={handleChange} />;
}

// Toolbar plugin
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  
  const formatBold = () => {
    editor.update(() => {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        document.execCommand('bold');
      }
    });
  };
  
  const formatItalic = () => {
    editor.update(() => {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        document.execCommand('italic');
      }
    });
  };
  
  return (
    <Toolbar>
      <ToolbarButton onClick={formatBold} title="Bold (Ctrl+B)">
        B
      </ToolbarButton>
      <ToolbarButton onClick={formatItalic} title="Italic (Ctrl+I)">
        <em>I</em>
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Heading: Use # at start of line">
        H
      </ToolbarButton>
      <ToolbarButton title="List: Use - at start of line">
        •
      </ToolbarButton>
      <ToolbarButton title="Quote: Use > at start of line">
        "
      </ToolbarButton>
      <ToolbarButton title="Code: Use ` around text">
        {'</>'}
      </ToolbarButton>
    </Toolbar>
  );
}

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
  /** Show preview by default - ignored, Lexical shows rich text inline */
  preview?: 'edit' | 'live' | 'preview';
  /** Hide toolbar */
  hideToolbar?: boolean;
  /** Additional class name */
  className?: string;
}

const theme = {
  paragraph: 'editor-paragraph',
  heading: {
    h1: 'editor-h1',
    h2: 'editor-h2',
    h3: 'editor-h3',
  },
  list: {
    ul: 'editor-ul',
    ol: 'editor-ol',
    listitem: 'editor-li',
  },
  quote: 'editor-quote',
  code: 'editor-code',
  link: 'editor-link',
  text: {
    bold: 'editor-bold',
    italic: 'editor-italic',
    strikethrough: 'editor-strikethrough',
    code: 'editor-inline-code',
  },
};

function onError(error: Error) {
  console.error('[MarkdownEditor] Error:', error);
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder = 'Write your content in markdown...',
  height = 300,
  hideToolbar = false,
  className,
}: MarkdownEditorProps) {
  const initialConfig = {
    namespace: 'MarkdownEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      LinkNode,
    ],
  };

  return (
    <EditorContainer className={className}>
      {label && (
        <Label>
          {label}
          <HelpText>Supports markdown formatting</HelpText>
        </Label>
      )}
      <LexicalComposer initialConfig={initialConfig}>
        <EditorWrapper $height={height}>
          {!hideToolbar && <ToolbarPlugin />}
          <RichTextPlugin
            contentEditable={<StyledContentEditable />}
            placeholder={<Placeholder>{placeholder}</Placeholder>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <ValuePlugin value={value} onChange={onChange} />
        </EditorWrapper>
      </LexicalComposer>
    </EditorContainer>
  );
}
