/**
 * EditablePlugin Component
 * Controls whether the Lexical editor is editable or read-only (preview mode)
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

interface EditablePluginProps {
  isPreviewMode: boolean;
}

export function EditablePlugin({ isPreviewMode }: EditablePluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Set editor to read-only when in preview mode, editable when in edit mode
    editor.setEditable(!isPreviewMode);
  }, [editor, isPreviewMode]);

  return null;
}
