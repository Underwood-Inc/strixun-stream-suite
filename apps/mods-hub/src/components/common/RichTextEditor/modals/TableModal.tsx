/**
 * TableModal Component
 * Modal for inserting tables in the rich text editor
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
import type { TableModalProps } from '../types';

export function TableModal({ isOpen, onClose, onInsert }: TableModalProps) {
  const [rows, setRows] = useState('3');
  const [cols, setCols] = useState('3');

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setRows('3');
      setCols('3');
    }
  }, [isOpen]);

  const handleInsert = useCallback(() => {
    const numRows = parseInt(rows, 10) || 3;
    const numCols = parseInt(cols, 10) || 3;
    onInsert(
      Math.min(Math.max(numRows, 1), 20),
      Math.min(Math.max(numCols, 1), 10)
    );
    onClose();
  }, [rows, cols, onInsert, onClose]);

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
        <ModalTitle>Insert Table</ModalTitle>
        <ModalLabel>Rows</ModalLabel>
        <ModalInput
          type="number"
          min="1"
          max="20"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <ModalLabel>Columns</ModalLabel>
        <ModalInput
          type="number"
          min="1"
          max="10"
          value={cols}
          onChange={(e) => setCols(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ModalActions>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton $primary onClick={handleInsert}>Insert</ModalButton>
        </ModalActions>
      </ModalContent>
    </ModalOverlay>
  );
}
