/**
 * Reusable Confirmation Modal Component
 * Requires user to type a randomly generated name to confirm destructive actions
 * 
 * This is an agnostic, reusable component that can be used anywhere in the app
 * for any confirmation that requires extra safety (deletions, irreversible actions, etc.)
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { generateRandomName } from '../../utils/nameGenerator';

const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: ${spacing.lg};
`;

const Modal = styled.div`
    background: ${colors.bgSecondary};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: ${spacing.xl};
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: ${spacing.lg};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
`;

const Title = styled.h2`
    font-size: 1.5rem;
    font-weight: 700;
    color: ${colors.text};
    margin: 0;
`;

const Message = styled.p`
    color: ${colors.textSecondary};
    line-height: 1.6;
    margin: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
`;

const ConfirmationSection = styled.div`
    display: flex;
    flex-direction: column;
    gap: ${spacing.md};
    padding: ${spacing.md};
    background: ${colors.bgTertiary};
    border-radius: 4px;
    border: 1px solid ${colors.border};
`;

const ConfirmationLabel = styled.label`
    font-size: 0.875rem;
    font-weight: 600;
    color: ${colors.text};
    display: flex;
    flex-direction: column;
    gap: ${spacing.xs};
`;

const ConfirmationText = styled.div`
    font-size: 0.75rem;
    color: ${colors.textMuted};
    font-family: monospace;
    background: ${colors.bg};
    padding: ${spacing.sm};
    border-radius: 4px;
    border: 1px solid ${colors.border};
    font-weight: 600;
    letter-spacing: 0.5px;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-all;
    white-space: pre-wrap;
    max-width: 100%;
    overflow: hidden;
`;

const Input = styled.input<{ hasError?: boolean }>`
    padding: ${spacing.sm} ${spacing.md};
    background: ${colors.bg};
    border: 1px solid ${props => props.hasError ? colors.danger : colors.border};
    border-radius: 4px;
    color: ${colors.text};
    font-size: 0.875rem;
    font-family: inherit;
    
    &:focus {
        outline: none;
        border-color: ${props => props.hasError ? colors.danger : colors.accent};
    }
`;

const ErrorMessage = styled.div`
    font-size: 0.75rem;
    color: ${colors.danger};
    margin-top: ${spacing.xs};
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: ${spacing.md};
    justify-content: flex-end;
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' | 'secondary' }>`
    padding: ${spacing.sm} ${spacing.md};
    border: 1px solid ${colors.border};
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
    
    ${props => {
        if (props.variant === 'danger') {
            return `
                background: ${colors.danger};
                color: #fff;
                &:hover:not(:disabled) {
                    background: ${colors.danger}dd;
                }
            `;
        }
        if (props.variant === 'primary') {
            return `
                background: ${colors.accent};
                color: ${colors.bg};
                &:hover:not(:disabled) {
                    background: ${colors.accentHover};
                }
            `;
        }
        return `
            background: ${colors.bgSecondary};
            color: ${colors.text};
            &:hover:not(:disabled) {
                background: ${colors.bgTertiary};
            }
        `;
    }}
    
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
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
        <Overlay onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}>
            <Modal onKeyDown={handleKeyDown}>
                <Title>{title}</Title>
                <Message>{message}</Message>
                
                <ConfirmationSection>
                    <ConfirmationLabel>
                        Type this name to confirm:
                        <ConfirmationText>{requiredName}</ConfirmationText>
                    </ConfirmationLabel>
                    <Input
                        type="text"
                        value={confirmationName}
                        onChange={(e) => {
                            setConfirmationName(e.target.value);
                            setError('');
                        }}
                        placeholder="Type the name above"
                        hasError={!!error}
                        disabled={isLoading}
                        autoFocus
                    />
                    {error && <ErrorMessage>{error}</ErrorMessage>}
                </ConfirmationSection>

                <ButtonGroup>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleConfirm}
                        disabled={isLoading || confirmationName.trim() !== requiredName}
                    >
                        {isLoading ? 'Processing...' : confirmText}
                    </Button>
                </ButtonGroup>
            </Modal>
        </Overlay>
    );

    // Render to portal to ensure it's above everything
    return createPortal(modalContent, document.body);
}

