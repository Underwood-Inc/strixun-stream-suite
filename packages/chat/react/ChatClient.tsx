/**
 * Chat Client Component
 * 
 * Main drop-in chat interface component for React applications
 */

import { useEffect, useCallback, useState } from 'react';
import type { ChatStore } from '../adapters/zustand.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';
import { RoomList } from './RoomList.js';
import { RoomCreator } from './RoomCreator.js';

export interface ChatClientProps {
  /** Zustand chat store hook */
  useChatStore: () => ChatStore;
  /** Current user ID */
  userId: string;
  /** Current user display name */
  userName: string;
  /** Show room list */
  showRoomList?: boolean;
  /** Show room creator */
  showRoomCreator?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

type ChatView = 'rooms' | 'create' | 'chat';

export function ChatClient({ 
  useChatStore,
  userId,
  userName,
  showRoomList = true,
  showRoomCreator = true,
  className = '',
  style,
}: ChatClientProps) {
  const store = useChatStore();
  const [currentView, setCurrentView] = useState<ChatView>('rooms');
  const [loading, setLoading] = useState(false);

  // Initialize chat on mount
  useEffect(() => {
    store.initialize(userId, userName);
    
    return () => {
      store.destroy();
    };
  }, [userId, userName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch to chat view when room is joined
  useEffect(() => {
    if (store.room && store.connectionState.status === 'connected') {
      setCurrentView('chat');
    }
  }, [store.room, store.connectionState.status]);

  const handleCreateRoom = useCallback(async (customName?: string) => {
    try {
      setLoading(true);
      await store.createRoom(customName);
      setCurrentView('chat');
    } catch (error) {
      console.error('[ChatClient] Failed to create room:', error);
    } finally {
      setLoading(false);
    }
  }, [store]);

  const handleJoinRoom = useCallback(async (roomId: string) => {
    try {
      setLoading(true);
      await store.joinRoom(roomId);
      setCurrentView('chat');
    } catch (error) {
      console.error('[ChatClient] Failed to join room:', error);
    } finally {
      setLoading(false);
    }
  }, [store]);

  const handleLeaveRoom = useCallback(async () => {
    try {
      await store.leaveRoom();
      setCurrentView('rooms');
    } catch (error) {
      console.error('[ChatClient] Failed to leave room:', error);
    }
  }, [store]);

  const handleSendMessage = useCallback(async (content: string) => {
    try {
      await store.sendMessage(content);
    } catch (error) {
      console.error('[ChatClient] Failed to send message:', error);
    }
  }, [store]);

  const handleTyping = useCallback((isTyping: boolean) => {
    store.sendTypingIndicator(isTyping);
  }, [store]);

  const fetchRooms = useCallback(() => {
    return store.getActiveRooms();
  }, [store]);

  const isConnected = store.connectionState.status === 'connected';
  const typingUsers = Array.from(store.typingUsers.values());

  return (
    <div 
      className={`chat-client ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card, #252525)',
        borderRadius: '8px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Error Banner */}
      {store.error && (
        <div 
          style={{
            padding: '12px 16px',
            background: 'rgba(244, 67, 54, 0.1)',
            color: 'var(--danger, #f44336)',
            fontSize: '0.875rem',
            borderBottom: '1px solid var(--border, #3a3a3a)',
          }}
        >
          {store.error}
        </div>
      )}

      {/* Chat View */}
      {currentView === 'chat' && (
        <>
          {/* Header */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'var(--bg-secondary, #252525)',
              borderBottom: '1px solid var(--border, #3a3a3a)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text, #f9f9f9)' }}>
              {store.room?.customName || store.room?.broadcasterName || 'Chat'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Connection Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div 
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isConnected 
                      ? 'var(--success, #4caf50)' 
                      : store.connectionState.status === 'connecting'
                        ? 'var(--warning, #ff9800)'
                        : 'var(--text-muted, #808080)',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #808080)' }}>
                  {isConnected ? 'Connected' : store.connectionState.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              {/* Leave Button */}
              <button
                onClick={handleLeaveRoom}
                style={{
                  padding: '4px 12px',
                  background: 'var(--bg-tertiary, #2d2d2d)',
                  border: '1px solid var(--border, #3a3a3a)',
                  borderRadius: '4px',
                  color: 'var(--text, #f9f9f9)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Leave
              </button>
            </div>
          </div>

          {/* Messages */}
          <div 
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {store.messages.length === 0 ? (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted, #808080)',
                }}
              >
                No messages yet. Start the conversation!
              </div>
            ) : (
              store.messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  currentUserId={userId}
                />
              ))
            )}
            
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div 
                style={{
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted, #808080)',
                  fontStyle: 'italic',
                }}
              >
                {typingUsers.length === 1 
                  ? `${typingUsers[0]} is typing...`
                  : `${typingUsers.length} people are typing...`}
              </div>
            )}
          </div>

          {/* Input */}
          <ChatInput 
            onSend={handleSendMessage}
            onTyping={handleTyping}
            disabled={!isConnected}
          />
        </>
      )}

      {/* Room List View */}
      {currentView === 'rooms' && showRoomList && (
        <RoomList
          fetchRooms={fetchRooms}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={showRoomCreator ? () => setCurrentView('create') : undefined}
          showCreateButton={showRoomCreator}
        />
      )}

      {/* Room Creator View */}
      {currentView === 'create' && showRoomCreator && (
        <RoomCreator
          onCreateRoom={handleCreateRoom}
          onCancel={() => setCurrentView('rooms')}
          loading={loading}
        />
      )}
    </div>
  );
}
