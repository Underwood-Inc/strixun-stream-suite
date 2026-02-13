/**
 * VideoModal Component
 * Modal for embedding external videos (YouTube/Vimeo) in the rich text editor
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ModalOverlay,
  ModalContent,
  ModalTitle,
  ModalLabel,
  ModalInput,
  ModalActions,
  ModalButton,
} from '../styles';
import type { VideoModalProps } from '../types';

export function VideoModal({ isOpen, onClose, onInsert }: VideoModalProps) {
  const [url, setUrl] = useState('');

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setUrl('');
    }
  }, [isOpen]);

  const handleInsert = useCallback(() => {
    if (url.trim()) {
      onInsert(url.trim());
      onClose();
    }
  }, [url, onInsert, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInsert();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleInsert, onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalTitle>Embed Video</ModalTitle>
        <ModalLabel>YouTube or Vimeo URL</ModalLabel>
        <ModalInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://youtube.com/watch?v=..."
          autoFocus
        />
        <ModalActions>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton $primary onClick={handleInsert}>Embed</ModalButton>
        </ModalActions>
      </ModalContent>
    </ModalOverlay>
  );
}
