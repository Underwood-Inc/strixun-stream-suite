/**
 * ToolbarPlugin Component
 * Full-featured toolbar UI for the Lexical rich text editor
 */

import { useState } from 'react';
import { formatFileSize } from '@strixun/api-framework';

import { MAX_RICH_TEXT_PAYLOAD } from './constants';
import type { ToolbarPluginProps } from './types';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarButton,
  ToolbarSelect,
  ToolbarDivider,
  PayloadIndicator,
  ModeControlsContainer,
  ModeToggle,
  DisplayModeSelect,
  HiddenInput,
} from './styles';
import { LinkModal, TableModal, VideoModal } from './modals';
import { useToolbarActions, useToolbarState } from './hooks';
import { colors, spacing } from '../../../theme';

export function ToolbarPlugin({
  totalUploadedSize,
  maxUploadSize,
  showPayloadSize,
  validation,
  payloadPercentage,
  uploadedImageCount,
  editorMode,
  previewDisplayMode,
  onEditorModeChange,
  onPreviewDisplayModeChange,
}: ToolbarPluginProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const { activeFormats } = useToolbarState();
  const {
    blockType,
    imageError,
    canAddMoreImages,
    fileInputRef,
    formatText,
    formatElement,
    insertHeading,
    insertQuote,
    insertCodeBlock,
    insertLink,
    insertTable,
    insertHorizontalRule,
    insertCollapsible,
    insertCarousel,
    insertVideo,
    insertBulletList,
    insertNumberedList,
    insertCheckList,
    undo,
    redo,
    clearEditor,
    handleImageSelect,
    triggerImageUpload,
  } = useToolbarActions({ totalUploadedSize, maxUploadSize });

  return (
    <>
      <Toolbar>
        {/* Undo/Redo */}
        <ToolbarGroup>
          <ToolbarButton onClick={undo} title="Undo (Ctrl+Z)">↩</ToolbarButton>
          <ToolbarButton onClick={redo} title="Redo (Ctrl+Y)">↪</ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Block Type */}
        <ToolbarGroup>
          <ToolbarSelect
            value={blockType}
            onChange={(e) => insertHeading(e.target.value as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'paragraph')}
            title="Block Type"
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </ToolbarSelect>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Text Formatting */}
        <ToolbarGroup>
          <ToolbarButton $active={activeFormats.has('bold')} onClick={() => formatText('bold')} title="Bold (Ctrl+B)">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('italic')} onClick={() => formatText('italic')} title="Italic (Ctrl+I)">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('underline')} onClick={() => formatText('underline')} title="Underline (Ctrl+U)">
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('strikethrough')} onClick={() => formatText('strikethrough')} title="Strikethrough">
            <s>S</s>
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('code')} onClick={() => formatText('code')} title="Inline Code">
            {'</>'}
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('subscript')} onClick={() => formatText('subscript')} title="Subscript">
            X<sub>2</sub>
          </ToolbarButton>
          <ToolbarButton $active={activeFormats.has('superscript')} onClick={() => formatText('superscript')} title="Superscript">
            X<sup>2</sup>
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarGroup>
          <ToolbarButton onClick={insertBulletList} title="Bullet List">•</ToolbarButton>
          <ToolbarButton onClick={insertNumberedList} title="Numbered List">1.</ToolbarButton>
          <ToolbarButton onClick={insertCheckList} title="Checklist">☑</ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Blocks */}
        <ToolbarGroup>
          <ToolbarButton onClick={insertQuote} title="Quote">"</ToolbarButton>
          <ToolbarButton onClick={insertCodeBlock} title="Code Block">{'{ }'}</ToolbarButton>
          <ToolbarButton onClick={insertHorizontalRule} title="Horizontal Rule">―</ToolbarButton>
          <ToolbarButton onClick={insertCollapsible} title="Collapsible Section">▼</ToolbarButton>
          <ToolbarButton onClick={insertCarousel} title="Image Carousel">🎠</ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Insert */}
        <ToolbarGroup>
          <ToolbarButton onClick={() => setShowLinkModal(true)} title="Insert Link">🔗</ToolbarButton>
          <ToolbarButton onClick={() => setShowTableModal(true)} title="Insert Table">⊞</ToolbarButton>
          <HiddenInput ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} />
          <ToolbarButton
            onClick={triggerImageUpload}
            disabled={!canAddMoreImages}
            title={canAddMoreImages
              ? `Insert Image (${formatFileSize(maxUploadSize - totalUploadedSize)} remaining)`
              : 'Upload limit reached'}
          >
            🖼
          </ToolbarButton>
          <ToolbarButton onClick={() => setShowVideoModal(true)} title="Embed External Video (YouTube/Vimeo)">▶</ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarGroup>
          <ToolbarButton onClick={() => formatElement('left')} title="Align Left">⬅</ToolbarButton>
          <ToolbarButton onClick={() => formatElement('center')} title="Align Center">↔</ToolbarButton>
          <ToolbarButton onClick={() => formatElement('right')} title="Align Right">➡</ToolbarButton>
          <ToolbarButton onClick={() => formatElement('justify')} title="Justify">☰</ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Clear */}
        <ToolbarGroup>
          <ToolbarButton onClick={clearEditor} title="Clear Editor">🗑</ToolbarButton>
        </ToolbarGroup>

        {imageError && (
          <span style={{ color: colors.danger, fontSize: '0.75rem', marginLeft: spacing.xs }}>
            {imageError}
          </span>
        )}

        {showPayloadSize && validation && (
          <PayloadIndicator $warning={payloadPercentage > 70} $error={payloadPercentage >= 100}>
            Uploaded: {formatFileSize(totalUploadedSize)} / {formatFileSize(MAX_RICH_TEXT_PAYLOAD)}
            {uploadedImageCount > 0 && ` (${uploadedImageCount} uploaded)`}
          </PayloadIndicator>
        )}

        <ModeControlsContainer>
          <ModeToggle
            $active={editorMode === 'edit'}
            onClick={() => onEditorModeChange('edit')}
            title="Edit mode"
          >
            Edit
          </ModeToggle>
          <ModeToggle
            $active={editorMode === 'preview'}
            onClick={() => onEditorModeChange('preview')}
            title="Preview mode"
          >
            Preview
          </ModeToggle>
          {editorMode === 'preview' && (
            <DisplayModeSelect
              value={previewDisplayMode}
              onChange={(e) => onPreviewDisplayModeChange(e.target.value as 'split' | 'full')}
              title="Preview display mode"
            >
              <option value="split">Split View</option>
              <option value="full">Full Preview</option>
            </DisplayModeSelect>
          )}
        </ModeControlsContainer>
      </Toolbar>

      {/* Modals */}
      <LinkModal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} onInsert={insertLink} />
      <TableModal isOpen={showTableModal} onClose={() => setShowTableModal(false)} onInsert={insertTable} />
      <VideoModal isOpen={showVideoModal} onClose={() => setShowVideoModal(false)} onInsert={insertVideo} />
    </>
  );
}
