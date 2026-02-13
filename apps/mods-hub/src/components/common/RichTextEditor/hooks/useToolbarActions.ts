/**
 * useToolbarActions Hook
 * Provides editor formatting and insertion actions for the toolbar
 */

import { useCallback, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CLEAR_EDITOR_COMMAND,
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import type { TextFormatType, ElementFormatType } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $createLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_COLLAPSIBLE_COMMAND, INSERT_CAROUSEL_COMMAND } from '../plugins';
import { formatFileSize } from '@strixun/api-framework';

export interface UseToolbarActionsProps {
  totalUploadedSize: number;
  maxUploadSize: number;
}

export function useToolbarActions({ totalUploadedSize, maxUploadSize }: UseToolbarActionsProps) {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<string>('paragraph');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Text formatting
  const formatText = useCallback((format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }, [editor]);

  const formatElement = useCallback((format: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  }, [editor]);

  // Block type changes
  const insertHeading = useCallback((headingType: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'paragraph') => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (headingType === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else {
          $setBlocksType(selection, () => $createHeadingNode(headingType));
        }
      }
    });
    setBlockType(headingType);
  }, [editor]);

  const insertQuote = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  }, [editor]);

  const insertCodeBlock = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createCodeNode());
      }
    });
  }, [editor]);

  // Link insertion
  const insertLink = useCallback((url: string) => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
  }, [editor]);

  // Table insertion
  const insertTable = useCallback((rows: number, cols: number) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      rows: rows.toString(),
      columns: cols.toString(),
      includeHeaders: true,
    });
  }, [editor]);

  // Special blocks
  const insertHorizontalRule = useCallback(() => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  }, [editor]);

  const insertCollapsible = useCallback(() => {
    editor.dispatchCommand(INSERT_COLLAPSIBLE_COMMAND, undefined);
  }, [editor]);

  const insertCarousel = useCallback(() => {
    editor.dispatchCommand(INSERT_CAROUSEL_COMMAND, undefined);
  }, [editor]);

  // Video embed
  const insertVideo = useCallback((videoUrl: string) => {
    if (!videoUrl) return;

    let embedUrl = '';
    const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);

    if (youtubeMatch) {
      embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    } else if (vimeoMatch) {
      embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    if (embedUrl) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const linkNode = $createLinkNode(embedUrl);
          linkNode.append($createTextNode(`Video: ${videoUrl}`));
          selection.insertNodes([linkNode]);
        }
      });
    }
  }, [editor]);

  // Image handling
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('video/')) {
      setImageError('Video uploads are not supported. Use external video embeds (YouTube/Vimeo) instead.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file');
      return;
    }

    const remainingSpace = maxUploadSize - totalUploadedSize;
    if (file.size > remainingSpace) {
      setImageError(`Cannot add image: would exceed upload limit (${formatFileSize(remainingSpace)} remaining)`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertRawText(`![${file.name}](${dataUrl})`);
        }
      });
      setImageError(null);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor, totalUploadedSize, maxUploadSize]);

  // List commands
  const insertBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertNumberedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const insertCheckList = useCallback(() => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  }, [editor]);

  // History commands
  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  const clearEditor = useCallback(() => {
    editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
  }, [editor]);

  // Check if we have space for more uploads (at least 100KB)
  const canAddMoreImages = (maxUploadSize - totalUploadedSize) > 100 * 1024;

  const triggerImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    // State
    blockType,
    imageError,
    canAddMoreImages,
    fileInputRef,

    // Text formatting
    formatText,
    formatElement,

    // Block types
    insertHeading,
    insertQuote,
    insertCodeBlock,

    // Insertions
    insertLink,
    insertTable,
    insertHorizontalRule,
    insertCollapsible,
    insertCarousel,
    insertVideo,

    // Lists
    insertBulletList,
    insertNumberedList,
    insertCheckList,

    // History
    undo,
    redo,
    clearEditor,

    // Image
    handleImageSelect,
    triggerImageUpload,
  };
}
