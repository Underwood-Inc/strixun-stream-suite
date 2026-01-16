/**
 * Chat Message Component
 * 
 * Displays a single chat message
 */

import type { ChatMessage as ChatMessageType } from '../core/types.js';

export interface ChatMessageProps {
  message: ChatMessageType;
  /** Current user ID to identify own messages */
  currentUserId?: string;
  /** Custom class name */
  className?: string;
}

export function ChatMessage({ 
  message, 
  currentUserId,
  className = '' 
}: ChatMessageProps) {
  const isOwnMessage = currentUserId && message.senderId === currentUserId;
  const displayName = message.senderDisplayName || message.senderName;
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div 
      className={`chat-message ${isOwnMessage ? 'chat-message--own' : ''} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 12px',
        background: isOwnMessage ? 'var(--accent-bg, rgba(212, 175, 55, 0.1))' : 'var(--bg-secondary, #252525)',
        borderRadius: '8px',
        border: '1px solid var(--border, #3a3a3a)',
        maxWidth: '80%',
        alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      }}
    >
      <div 
        className="chat-message__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
        }}
      >
        <span 
          className="chat-message__sender"
          style={{
            fontWeight: 600,
            color: isOwnMessage ? 'var(--accent, #d4af37)' : 'var(--text, #f9f9f9)',
          }}
        >
          {displayName}
        </span>
        <span 
          className="chat-message__time"
          style={{
            color: 'var(--text-muted, #808080)',
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
      <div 
        className="chat-message__content"
        style={{
          color: 'var(--text, #f9f9f9)',
          fontSize: '0.875rem',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
