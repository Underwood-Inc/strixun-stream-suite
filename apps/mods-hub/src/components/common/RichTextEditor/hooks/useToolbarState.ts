/**
 * useToolbarState Hook
 * Tracks active formatting state based on editor selection
 */

import { useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import type { TextFormatType } from 'lexical';

export function useToolbarState() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(new Set());

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const formats = new Set<TextFormatType>();
          if (selection.hasFormat('bold')) formats.add('bold');
          if (selection.hasFormat('italic')) formats.add('italic');
          if (selection.hasFormat('underline')) formats.add('underline');
          if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
          if (selection.hasFormat('code')) formats.add('code');
          if (selection.hasFormat('subscript')) formats.add('subscript');
          if (selection.hasFormat('superscript')) formats.add('superscript');
          setActiveFormats(formats);
        }
      });
    });
  }, [editor]);

  return { activeFormats };
}
