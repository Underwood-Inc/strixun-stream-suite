/**
 * FloatingLinkEditorPlugin
 * Shows a floating editor when a link is selected, allowing users to edit/remove links
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import styled from 'styled-components';
import { colors, spacing } from '../../../../theme';

const FloatingEditor = styled.div<{ $visible: boolean }>`
  position: fixed;
  z-index: 10000;
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: ${spacing.sm};
  display: ${props => props.$visible ? 'flex' : 'none'};
  flex-direction: column;
  gap: ${spacing.xs};
  min-width: 300px;
`;

const LinkInput = styled.input`
  background: ${colors.bgTertiary};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.8125rem;
  outline: none;
  width: 100%;
  
  &:focus {
    border-color: ${colors.accent};
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: ${spacing.xs};
  justify-content: flex-end;
`;

const EditorButton = styled.button<{ $danger?: boolean }>`
  background: ${props => props.$danger ? colors.danger : colors.accent};
  border: none;
  border-radius: 4px;
  color: ${colors.bg};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
  }
`;

const CancelButton = styled.button`
  background: transparent;
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.textSecondary};
  padding: ${spacing.xs} ${spacing.sm};
  font-size: 0.75rem;
  cursor: pointer;
  
  &:hover {
    background: ${colors.bgTertiary};
  }
`;

const LinkLabel = styled.span`
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.textMuted};
`;

function getSelectedLinkNode(selection: ReturnType<typeof $getSelection>) {
  if (!$isRangeSelection(selection)) return null;
  
  const nodes = selection.getNodes();
  for (const node of nodes) {
    const parent = node.getParent();
    if ($isLinkNode(parent)) {
      return parent;
    }
    if ($isLinkNode(node)) {
      return node;
    }
  }
  return null;
}

function positionEditorElement(
  editor: HTMLDivElement,
  rect: DOMRect | null
) {
  if (!rect) {
    editor.style.opacity = '0';
    editor.style.top = '-1000px';
    editor.style.left = '-1000px';
    return;
  }

  // Fixed positioning uses viewport coordinates directly
  editor.style.opacity = '1';
  editor.style.top = `${rect.bottom + 8}px`;
  editor.style.left = `${rect.left}px`;
}

export function FloatingLinkEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const editorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [lastSelection, setLastSelection] = useState<ReturnType<typeof $getSelection>>(null);

  const updateEditor = useCallback(() => {
    const selection = $getSelection();
    
    if (!$isRangeSelection(selection)) {
      setIsVisible(false);
      return;
    }

    const linkNode = getSelectedLinkNode(selection);
    
    if (linkNode) {
      setLinkUrl(linkNode.getURL());
      setIsVisible(true);
      setLastSelection(selection);
    } else {
      setIsVisible(false);
      setLinkUrl('');
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateEditor();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateEditor();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isVisible) {
            setIsVisible(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor, updateEditor, isVisible]);

  useEffect(() => {
    const editorElem = editorRef.current;

    if (!editorElem) return;

    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) {
      positionEditorElement(editorElem, null);
      return;
    }

    const range = nativeSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    positionEditorElement(editorElem, rect);
  }, [isVisible, linkUrl]);

  const handleSave = useCallback(() => {
    if (lastSelection) {
      editor.update(() => {
        if (linkUrl.trim()) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, linkUrl);
        }
      });
    }
    setIsVisible(false);
  }, [editor, linkUrl, lastSelection]);

  const handleRemove = useCallback(() => {
    editor.update(() => {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    });
    setIsVisible(false);
    setLinkUrl('');
  }, [editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsVisible(false);
    }
  }, [handleSave]);

  return createPortal(
    <FloatingEditor ref={editorRef} $visible={isVisible}>
      <LinkLabel>Edit Link URL</LinkLabel>
      <LinkInput
        ref={inputRef}
        type="url"
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="https://example.com"
      />
      <ButtonRow>
        <CancelButton onClick={() => setIsVisible(false)}>Cancel</CancelButton>
        <EditorButton $danger onClick={handleRemove}>Remove</EditorButton>
        <EditorButton onClick={handleSave}>Save</EditorButton>
      </ButtonRow>
    </FloatingEditor>,
    document.body
  );
}

export default FloatingLinkEditorPlugin;
