/**
 * ActionMenu Component
 * A dropdown menu for table row actions with keyboard navigation support
 * 
 * Features:
 * - Kebab menu trigger (three dots)
 * - Portal rendering for proper z-index
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click outside to close
 * - Customizable menu items with icons
 * - Disabled items support
 * - Dividers support
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ActionMenuItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger' | 'primary';
    divider?: boolean; // Show divider after this item
}

export interface ActionMenuProps {
    items: ActionMenuItem[];
    triggerLabel?: string;
    className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
    items,
    triggerLabel = '⋯',
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [focusedIndex, setFocusedIndex] = useState(0);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const enabledItems = items.filter(item => !item.disabled);

    useEffect(() => {
        if (!isOpen) return;

        // Add a small delay before attaching click outside handler
        // This prevents immediate closing when opening the menu
        const timeoutId = setTimeout(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    menuRef.current &&
                    !menuRef.current.contains(event.target as Node) &&
                    triggerRef.current &&
                    !triggerRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }, 100);

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
            });
        }
        
        setIsOpen(!isOpen);
        setFocusedIndex(0);
    };

    const handleItemClick = (item: ActionMenuItem, e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.disabled) return;
        
        item.onClick();
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex((prev) => (prev + 1) % enabledItems.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex((prev) => (prev - 1 + enabledItems.length) % enabledItems.length);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                const focusedItem = enabledItems[focusedIndex];
                if (focusedItem) {
                    focusedItem.onClick();
                    setIsOpen(false);
                }
                break;
        }
    };

    const menu = isOpen ? (
        <div
            ref={menuRef}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                zIndex: 99999,
                minWidth: '200px',
                backgroundColor: '#252017',
                border: '1px solid #3d3627',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                padding: '4px 0',
                maxHeight: '400px',
                overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => {
                const isFocused = enabledItems.indexOf(item) === focusedIndex;
                const variantColor = item.variant === 'danger' 
                    ? '#dc3545' 
                    : item.variant === 'primary'
                    ? '#edae49'
                    : '#f9f9f9';

                return (
                    <React.Fragment key={item.key}>
                        <button
                            onClick={(e) => handleItemClick(item, e)}
                            disabled={item.disabled}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                border: 'none',
                                background: isFocused ? '#3d3627' : 'transparent',
                                color: item.disabled ? '#888' : variantColor,
                                textAlign: 'left',
                                cursor: item.disabled ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                transition: 'background 0.15s ease',
                                opacity: item.disabled ? 0.5 : 1,
                            }}
                            onMouseEnter={() => !item.disabled && setFocusedIndex(enabledItems.indexOf(item))}
                        >
                            {item.icon && <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>}
                            <span>{item.label}</span>
                        </button>
                        {item.divider && (
                            <div style={{
                                height: '1px',
                                backgroundColor: '#3d3627',
                                margin: '4px 0',
                            }} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    ) : null;

    return (
        <>
            <button
                ref={triggerRef}
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                className={className}
                style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid #3d3627',
                    borderRadius: '6px',
                    color: '#f9f9f9',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '40px',
                    minHeight: '36px',
                }}
                aria-label="Actions menu"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {triggerLabel}
            </button>
            {menu && createPortal(menu, document.body)}
        </>
    );
};
