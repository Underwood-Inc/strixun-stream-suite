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
import { IntegrityBadge } from './IntegrityBadge.js';

// Note: CSS should be imported by the consuming app:
// import '@strixun/chat/react/chat.css';

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
  
  // P2P Persistence state
  const integrityInfo = store.integrityInfo;
  const peerCount = store.peerCount;

  return (
    <div className={`chat-client ${className}`} style={style}>
      {/* Error Banner */}
      {store.error && (
        <div className="chat-client__error">
          {store.error}
        </div>
      )}

      {/* Chat View */}
      {currentView === 'chat' && (
        <>
          {/* Header */}
          <div className="chat-client__header">
            <div className="chat-client__header-title">
              {store.room?.customName || store.room?.broadcasterName || 'Chat'}
            </div>
            <div className="chat-client__header-actions">
              {/* Integrity Badge */}
              {integrityInfo && (
                <IntegrityBadge 
                  integrityInfo={integrityInfo}
                  peerCount={peerCount}
                  showDetails={false}
                />
              )}
              {/* Connection Status */}
              <div className="chat-client__connection">
                <div 
                  className={`chat-client__connection-dot ${
                    isConnected 
                      ? 'chat-client__connection-dot--connected' 
                      : store.connectionState.status === 'connecting'
                        ? 'chat-client__connection-dot--connecting'
                        : ''
                  }`}
                />
                <span className="chat-client__connection-text">
                  {isConnected ? 'Connected' : store.connectionState.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              {/* Leave Button */}
              <button
                className="chat-btn chat-btn--secondary chat-btn--small"
                onClick={handleLeaveRoom}
              >
                Leave
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-client__messages">
            {store.messages.length === 0 ? (
              <div className="chat-client__messages-empty">
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
              <div className="chat-client__typing">
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
