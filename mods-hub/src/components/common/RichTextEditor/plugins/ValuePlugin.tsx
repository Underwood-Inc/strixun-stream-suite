/**
 * ValuePlugin Component
 * Handles state synchronization between Lexical editor and parent component
 * Manages JSON serialization/deserialization and media extraction
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import type { EditorState } from 'lexical';
import type { EmbeddedMediaInfo } from '../types';

/** Debounce delay for onChange (ms) - balances responsiveness vs performance */
const DEBOUNCE_DELAY = 150;

interface ValuePluginProps {
  value: string;
  onChange: (value: string) => void;
  onMediaChange: (media: EmbeddedMediaInfo[]) => void;
}

/** Extract media info from editor state JSON */
function extractMediaFromState(root: Record<string, unknown>): EmbeddedMediaInfo[] {
  const mediaMatches: EmbeddedMediaInfo[] = [];

  const findMedia = (node: Record<string, unknown>) => {
    // Handle image nodes
    if (node.type === 'image' && typeof node.src === 'string') {
      const url = node.src;
      let size = 0;
      if (url.startsWith('data:')) {
        const base64Part = url.split(',')[1];
        if (base64Part) {
          size = Math.ceil(base64Part.length * 0.75);
        }
      }
      mediaMatches.push({ type: 'image', url, size });
    }

    // Handle carousel nodes
    if (node.type === 'carousel' && Array.isArray(node.images)) {
      for (const img of node.images as Array<{ src?: string; url?: string; size?: number }>) {
        // CarouselImage uses 'src', not 'url'
        const url = img.src || img.url;
        if (!url || typeof url !== 'string') continue;
        
        // Use stored size if available, otherwise calculate from base64
        let size = img.size || 0;
        if (size === 0 && url.startsWith('data:')) {
          const base64Part = url.split(',')[1];
          if (base64Part) {
            size = Math.ceil(base64Part.length * 0.75);
          }
        }
        mediaMatches.push({ type: 'image', url, size });
      }
    }

    // Traverse children recursively
    if (Array.isArray(node.children)) {
      for (const child of node.children as Array<Record<string, unknown>>) {
        findMedia(child);
      }
    }
  };

  findMedia(root);
  return mediaMatches;
}

export function ValuePlugin({
  value,
  onChange,
  onMediaChange,
}: ValuePluginProps) {
  const [editor] = useLexicalComposerContext();
  const isInitialized = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStateRef = useRef<EditorState | null>(null);

  // Initialize editor with saved JSON state
  useEffect(() => {
    if (value && !isInitialized.current) {
      isInitialized.current = true;
      try {
        const parsedState = editor.parseEditorState(value);
        editor.setEditorState(parsedState);
        
        // Extract media from initial state
        const root = parsedState.toJSON().root;
        const media = extractMediaFromState(root as Record<string, unknown>);
        onMediaChange(media);
      } catch (e) {
        console.warn('[RichTextEditor] Could not parse saved state, starting fresh');
      }
    }
  }, [editor, value, onMediaChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((editorState: EditorState) => {
    // Store latest state for debounced processing
    lastStateRef.current = editorState;
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce expensive serialization operations
    debounceTimerRef.current = setTimeout(() => {
      const stateToProcess = lastStateRef.current;
      if (!stateToProcess) return;
      
      // Serialize to JSON string for storage
      const json = stateToProcess.toJSON();
      const jsonString = JSON.stringify(json);
      onChange(jsonString);

      // Extract media for size validation
      const root = json.root;
      const media = extractMediaFromState(root as Record<string, unknown>);
      onMediaChange(media);
    }, DEBOUNCE_DELAY);
  }, [onChange, onMediaChange]);

  return <OnChangePlugin onChange={handleChange} />;
}
