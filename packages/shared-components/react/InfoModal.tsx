/**
 * InfoModal Component
 * A simple modal for displaying information with a close button
 * Portal-rendered for proper z-index handling
 */

import React from 'react';
import { createPortal } from 'react-dom';

export interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    closeText?: string;
    maxWidth?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    closeText = 'Close',
    maxWidth = '600px',
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const modal = (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                padding: '20px',
            }}
            onClick={handleBackdropClick}
        >
            <div
                style={{
                    backgroundColor: '#252017',
                    border: '1px solid #3d3627',
                    borderRadius: '12px',
                    maxWidth,
                    width: '100%',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #3d3627',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#edae49',
                        }}
                    >
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            lineHeight: 1,
                            transition: 'color 0.2s ease',
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div
                    style={{
                        padding: '24px',
                        color: '#f9f9f9',
                    }}
                >
                    {children}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid #3d3627',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 24px',
                            backgroundColor: '#edae49',
                            color: '#1a1611',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {closeText}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
};
