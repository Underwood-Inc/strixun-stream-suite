/**
 * LinkModal Component
 * Modal for inserting/editing links in the rich text editor
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
import type { LinkModalProps } from '../types';

export function LinkModal({ isOpen, onClose, onInsert }: LinkModalProps) {
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
        <ModalTitle>Insert Link</ModalTitle>
        <ModalLabel>URL</ModalLabel>
        <ModalInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          autoFocus
        />
        <ModalActions>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton $primary onClick={handleInsert}>Insert</ModalButton>
        </ModalActions>
      </ModalContent>
    </ModalOverlay>
  );
}
