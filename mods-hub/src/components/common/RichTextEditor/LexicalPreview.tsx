/**
 * LexicalPreview Component
 * Standalone, reusable component for rendering Lexical JSON state as HTML
 * Can be used independently of the RichTextEditor for displaying content
 * Also supports rendering markdown content by converting it first
 */

import { useEffect, useState, useMemo } from 'react';
import { createHeadlessEditor } from '@lexical/headless';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $convertFromMarkdownString } from '@lexical/markdown';
import { EXTENDED_TRANSFORMERS } from './markdownTransformers';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { HorizontalRuleNode } from '@lexical/extension';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { OverflowNode } from '@lexical/overflow';

import {
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
} from '../CollapsiblePlugin';
import { CarouselNode } from '../CarouselPlugin';
import { ImageNode } from './ImageNode';
import { VideoEmbedNode } from './VideoEmbedNode';
import { PreviewContainer } from './styles';

/**
 * Detect if content is Lexical JSON or markdown
 */
function isLexicalJson(content: string): boolean {
  if (!content || !content.trim()) return false;
  
  try {
    const parsed = JSON.parse(content);
    // Lexical JSON has a root object with a specific structure
    return parsed && typeof parsed === 'object' && 'root' in parsed;
  } catch {
    return false;
  }
}

export interface LexicalPreviewProps {
  /** Lexical JSON state string to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * All nodes that must be registered for proper HTML generation
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

/**
 * LexicalPreview - Renders Lexical JSON state as styled HTML
 * 
 * This is a standalone component that can be used anywhere to display
 * content created with the RichTextEditor. It uses Lexical's headless
 * editor to generate HTML without rendering the full editor UI.
 * 
 * @example
 * // Display saved content from database
 * <LexicalPreview content={mod.description} />
 * 
 * @example
 * // With custom styling
 * <LexicalPreview content={content} className="mod-description" />
 */
export function LexicalPreview({ content, className, style }: LexicalPreviewProps) {
  const [html, setHtml] = useState<string>('');

  // Create headless editor instance (memoized for performance)
  const headlessEditor = useMemo(() => {
    return createHeadlessEditor({
      namespace: 'LexicalPreview',
      nodes: PREVIEW_NODES,
      onError: (error) => {
        console.error('[LexicalPreview] Error:', error);
      },
    });
  }, []);

  // Generate HTML when content changes
  useEffect(() => {
    if (!content) {
      setHtml('');
      return;
    }

    try {
      if (isLexicalJson(content)) {
        // Content is Lexical JSON - parse and render
        const editorState = headlessEditor.parseEditorState(content);
        headlessEditor.setEditorState(editorState);
        headlessEditor.getEditorState().read(() => {
          const generatedHtml = $generateHtmlFromNodes(headlessEditor, null);
          setHtml(generatedHtml);
        });
      } else {
        // Content is likely markdown - convert first
        headlessEditor.update(() => {
          $convertFromMarkdownString(content, EXTENDED_TRANSFORMERS);
        }, { discrete: true });
        
        // Then generate HTML from the converted state
        headlessEditor.getEditorState().read(() => {
          const generatedHtml = $generateHtmlFromNodes(headlessEditor, null);
          setHtml(generatedHtml);
        });
      }
    } catch (e) {
      console.warn('[LexicalPreview] Could not parse content:', e);
      // Fallback: show as preformatted text
      setHtml(`<pre style="white-space: pre-wrap; word-break: break-word;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
    }
  }, [content, headlessEditor]);

  return (
    <PreviewContainer
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default LexicalPreview;
