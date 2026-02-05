/**
 * Preview Component
 * Standalone, reusable component for rendering rich text editor state
 * Uses a full Lexical editor in read-only mode to properly render all nodes
 * including decorator nodes like carousels
 */

import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/extension';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { OverflowNode } from '@lexical/overflow';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import styled from 'styled-components';

import {
  CollapsiblePlugin,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  CarouselPlugin,
  CarouselNode,
} from './plugins';
import { ImageNode, VideoEmbedNode } from './nodes';
import { editorTheme } from './theme';
import { PreviewContainer } from './styles';
import { colors } from '../../../theme';

export interface PreviewProps {
  /** Editor JSON state string to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * All nodes that must be registered for proper rendering
 * Keep in sync with RichTextEditor node configuration
 */
const PREVIEW_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  LinkNode,
  AutoLinkNode,
  HorizontalRuleNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  MarkNode,
  OverflowNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  CarouselNode,
  ImageNode,
  VideoEmbedNode,
];

const ReadOnlyContentEditable = styled(ContentEditable)`
  outline: none;
  cursor: default;
`;

const PreviewPlaceholder = styled.div`
  color: ${colors.textMuted};
  font-style: italic;
`;

/**
 * Plugin to load content and set editor to read-only
 */
function PreviewStatePlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Set editor to read-only
    editor.setEditable(false);

    if (!content) return;

    try {
      // Check if content is valid editor JSON
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && 'root' in parsed) {
        const editorState = editor.parseEditorState(content);
        editor.setEditorState(editorState);
      }
    } catch (e) {
      console.warn('[Preview] Could not parse content:', e);
    }
  }, [content, editor]);

  return null;
}

/**
 * Preview - Renders rich text editor state with full fidelity
 * 
 * Uses a complete Lexical editor in read-only mode to properly render
 * all content including decorator nodes like carousels with their
 * full functionality (Grid/Slideshow modes).
 * 
 * @example
 * // Display saved content from database
 * <Preview content={mod.description} />
 */
export function Preview({ content, className, style }: PreviewProps) {
  const initialConfig = {
    namespace: 'Preview',
    theme: editorTheme,
    nodes: PREVIEW_NODES,
    editable: false,
    onError: (error: Error) => {
      console.error('[Preview] Error:', error);
    },
  };

  if (!content) {
    return (
      <PreviewContainer className={className} style={style}>
        <PreviewPlaceholder>No content</PreviewPlaceholder>
      </PreviewContainer>
    );
  }

  return (
    <PreviewContainer className={className} style={style}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={<ReadOnlyContentEditable />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <ListPlugin />
        <TablePlugin />
        <CollapsiblePlugin />
        <CarouselPlugin
          maxUploadSize={50 * 1024 * 1024}
          currentUploadSize={0}
        />
        <PreviewStatePlugin content={content} />
      </LexicalComposer>
    </PreviewContainer>
  );
}

export default Preview;
