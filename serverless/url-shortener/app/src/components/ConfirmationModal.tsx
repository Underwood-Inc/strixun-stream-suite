/**
 * Reusable Confirmation Modal Component
 * Requires user to type a randomly generated name to confirm destructive actions
 * 
 * This is an agnostic, reusable component that can be used anywhere in the app
 * for any confirmation that requires extra safety (deletions, irreversible actions, etc.)
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateRandomName } from '../utils/nameGenerator';
import '../app.scss';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}: ConfirmationModalProps) {
  const [confirmationName, setConfirmationName] = useState('');
  const [requiredName, setRequiredName] = useState('');
  const [error, setError] = useState('');

  // Generate a new random name when modal opens
  useEffect(() => {
    if (isOpen) {
      const newName = generateRandomName(true);
      setRequiredName(newName);
      setConfirmationName('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (confirmationName.trim() !== requiredName) {
      setError('The confirmation name does not match. Please type it exactly as shown.');
      return;
    }

    setError('');
    try {
      await onConfirm();
      onClose();
    } catch {
      // Error handling is up to the parent component
      // We just close the modal if confirm succeeds
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && confirmationName.trim() === requiredName && !isLoading) {
      handleConfirm();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="confirmation-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
    >
      <div className="confirmation-modal" onKeyDown={handleKeyDown}>
        <h2 className="confirmation-modal__title">{title}</h2>
        <div className="confirmation-modal__message">{message}</div>
        
        <div className="confirmation-modal__section">
          <label className="confirmation-modal__label">
            Type this name to confirm:
            <div className="confirmation-modal__text">{requiredName}</div>
          </label>
          <input
            type="text"
            className={`confirmation-modal__input ${error ? 'confirmation-modal__input--error' : ''}`}
            value={confirmationName}
            onChange={(e) => {
              setConfirmationName(e.target.value);
              setError('');
            }}
            placeholder="Type the name above"
            disabled={isLoading}
            autoFocus
          />
          {error && <div className="confirmation-modal__error">{error}</div>}
        </div>

        <div className="confirmation-modal__buttons">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={isLoading || confirmationName.trim() !== requiredName}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Render to portal to ensure it's above everything
  return createPortal(modalContent, document.body);
}
