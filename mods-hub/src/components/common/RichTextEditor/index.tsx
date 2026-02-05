/**
 * RichTextEditor Component
 * Full-featured rich text editor using Lexical from Meta
 * Supports formatting, lists, tables, images, videos, collapsibles, and more
 */

import { useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode } from '@lexical/code';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { AutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { HorizontalRuleNode } from '@lexical/extension';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagPlugin } from '@lexical/react/LexicalHashtagPlugin';
import { HashtagNode } from '@lexical/hashtag';
import { MarkNode } from '@lexical/mark';
import { OverflowNode } from '@lexical/overflow';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { SelectionAlwaysOnDisplay } from '@lexical/react/LexicalSelectionAlwaysOnDisplay';
import { CharacterLimitPlugin } from '@lexical/react/LexicalCharacterLimitPlugin';
import type { EmbeddedMediaInfo } from '@strixun/api-framework';

import {
  CollapsiblePlugin,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  CarouselPlugin,
  CarouselNode,
  ToolbarPlugin,
  ValuePlugin,
  EditablePlugin,
  MarkdownPastePlugin,
  FloatingLinkEditorPlugin,
  HorizontalRulePlugin,
} from './plugins';

import { MAX_RICH_TEXT_PAYLOAD, AUTO_LINK_MATCHERS } from './constants';
import { editorTheme } from './theme';
import type { RichTextEditorProps } from './types';
import {
  EditorContainer,
  EditorWrapper,
  StyledContentEditable,
  Placeholder,
  Label,
  HelpText,
} from './styles';
import { ImageNode, VideoEmbedNode } from './nodes';
import { EXTENDED_TRANSFORMERS } from './transformers';

/** Error handler for Lexical */
function onError(error: Error) {
  console.error('[RichTextEditor] Error:', error);
}

/**
 * RichTextEditor - Full-featured rich text editor powered by Lexical
 *
 * Features:
 * - Text formatting (bold, italic, underline, strikethrough, code, sub/superscript)
 * - Block types (headings, paragraphs, quotes, code blocks)
 * - Lists (bullet, numbered, checklist)
 * - Tables with header support
 * - Links with auto-detection
 * - Image uploads with size validation
 * - External video embeds (YouTube, Vimeo)
 * - Collapsible sections
 * - Image carousels
 * - Hashtag highlighting
 * - Undo/redo history
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = 'Write your content...',
  height = 300,
  hideToolbar = false,
  className,
  showPayloadSize = true,
  autoFocus = false,
  maxLength,
}: RichTextEditorProps) {
  const [embeddedMedia, setEmbeddedMedia] = useState<EmbeddedMediaInfo[]>([]);
  const [carouselUploadSize, setCarouselUploadSize] = useState(0);

  // Calculate total uploaded size (inline images + carousel images)
  // Only count base64/uploaded images, not external URLs
  const inlineUploadedSize = embeddedMedia
    .filter(m => m.type === 'image' && m.url.startsWith('data:'))
    .reduce((total, m) => total + m.size, 0);
  const totalUploadedSize = inlineUploadedSize + carouselUploadSize;

  // Count only uploaded images (not external URLs)
  const uploadedImageCount = embeddedMedia.filter(m => m.type === 'image' && m.url.startsWith('data:')).length;
  const payloadPercentage = (totalUploadedSize / MAX_RICH_TEXT_PAYLOAD) * 100;

  const initialConfig = {
    namespace: 'RichTextEditor',
    theme: editorTheme,
    onError,
    nodes: [
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
    ],
  };

  return (
    <EditorContainer className={className}>
      {label && (
        <Label>
          {label}
          <HelpText>Rich text editor powered by Lexical</HelpText>
        </Label>
      )}
      <LexicalComposer initialConfig={initialConfig}>
        {!hideToolbar && (
          <>
            <ToolbarPlugin
              totalUploadedSize={totalUploadedSize}
              maxUploadSize={MAX_RICH_TEXT_PAYLOAD}
              showPayloadSize={showPayloadSize}
              payloadPercentage={payloadPercentage}
              uploadedImageCount={uploadedImageCount}
            />
          </>
        )}

        <EditorWrapper $height={height}>
          <RichTextPlugin
            contentEditable={<StyledContentEditable />}
            placeholder={<Placeholder>{placeholder}</Placeholder>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <EditablePlugin isPreviewMode={false} />
          
          {/* Core plugins */}
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <FloatingLinkEditorPlugin />
          <CheckListPlugin />
          <TabIndentationPlugin />
          <AutoLinkPlugin matchers={AUTO_LINK_MATCHERS} />
          <ClearEditorPlugin />
          <HorizontalRulePlugin />
          <TablePlugin />
          <HashtagPlugin />
          <CollapsiblePlugin />
          <CarouselPlugin
            maxUploadSize={MAX_RICH_TEXT_PAYLOAD}
            currentUploadSize={totalUploadedSize}
            onUploadSizeChange={setCarouselUploadSize}
          />
          <SelectionAlwaysOnDisplay />
          <MarkdownShortcutPlugin transformers={EXTENDED_TRANSFORMERS} />
          <MarkdownPastePlugin />
          {autoFocus && <AutoFocusPlugin />}
          {maxLength && <CharacterLimitPlugin maxLength={maxLength} charset="UTF-16" />}
          <ValuePlugin
            value={value}
            onChange={onChange}
            onMediaChange={setEmbeddedMedia}
          />
        </EditorWrapper>
      </LexicalComposer>
    </EditorContainer>
  );
}

// Re-export types for consumers
export type { RichTextEditorProps } from './types';
