/**
 * Chat Message Component
 * 
 * Displays a single chat message
 */

import type { ChatMessage as ChatMessageType } from '../core/types.js';

export interface ChatMessageProps {
  message: ChatMessageType;
  currentUserId: string;
}

export function ChatMessage({ message, currentUserId }: ChatMessageProps) {
  const isOwnMessage = message.senderId === currentUserId;
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`chat-message ${isOwnMessage ? 'chat-message--own' : ''}`}>
      <div className="chat-message__header">
        <span className="chat-message__sender">
          {message.senderDisplayName || message.senderName}
        </span>
        <span className="chat-message__time">
          {timestamp}
        </span>
      </div>
      <div className="chat-message__content">
        {message.content}
      </div>
    </div>
  );
}
