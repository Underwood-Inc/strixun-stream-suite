/**
 * Chat Input Component
 * 
 * Text input for sending chat messages
 */

import { useState, useRef, useCallback } from 'react';

export interface ChatInputProps {
  /** Called when user submits a message */
  onSend: (content: string) => void;
  /** Called when user starts/stops typing */
  onTyping?: (isTyping: boolean) => void;
  /** Disable input */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Custom class name */
  className?: string;
}

export function ChatInput({ 
  onSend, 
  onTyping,
  disabled = false,
  placeholder = 'Type a message... (Enter to send, Shift+Enter for new line)',
  className = ''
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTyping = useCallback(() => {
    if (!onTyping) return;
    
    onTyping(true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  }, [onTyping]);

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled) return;
    
    onSend(trimmedMessage);
    setMessage('');
    
    // Stop typing indicator
    if (onTyping) {
      onTyping(false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [message, disabled, onSend, onTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    handleTyping();
  }, [handleTyping]);

  return (
    <div 
      className={`chat-input ${className}`}
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        background: 'var(--bg-secondary, #252525)',
        borderTop: '1px solid var(--border, #3a3a3a)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          padding: '10px 12px',
          background: 'var(--bg, #1a1a1a)',
          border: '1px solid var(--border, #3a3a3a)',
          borderRadius: '4px',
          color: 'var(--text, #f9f9f9)',
          fontSize: '0.875rem',
          resize: 'none',
          fontFamily: 'inherit',
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !message.trim()}
        style={{
          padding: '10px 20px',
          background: disabled || !message.trim() 
            ? 'var(--bg-tertiary, #2d2d2d)' 
            : 'var(--accent, #d4af37)',
          color: disabled || !message.trim() 
            ? 'var(--text-muted, #808080)' 
            : 'var(--bg, #1a1a1a)',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: disabled || !message.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        Send
      </button>
    </div>
  );
}
