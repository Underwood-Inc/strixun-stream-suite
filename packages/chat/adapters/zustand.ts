/**
 * Zustand Adapter for @strixun/chat
 * 
 * Provides a Zustand store for React applications
 */

import { create } from 'zustand';
import { 
  RoomManager, 
  type RoomManagerConfig,
  type ChatMessage, 
  type RoomMetadata, 
  type ChatConnectionState 
} from '../core/index.js';

export interface ChatStoreConfig {
  signalingBaseUrl: string;
  /** Override fetch function for authentication */
  authenticatedFetch?: RoomManagerConfig['authenticatedFetch'];
  /** Encryption functions */
  encrypt?: RoomManagerConfig['encrypt'];
  decrypt?: RoomManagerConfig['decrypt'];
}

export interface ChatStore {
  // State
  room: RoomMetadata | null;
  messages: ChatMessage[];
  participants: string[];
  typingUsers: Map<string, string>;
  connectionState: ChatConnectionState;
  error: string | null;
  isInitialized: boolean;
  
  // Room manager instance (internal)
  roomManager: RoomManager | null;
  
  // Actions
  initialize: (userId: string, userName: string) => void;
  createRoom: (customName?: string) => Promise<RoomMetadata>;
  joinRoom: (roomId: string) => Promise<RoomMetadata>;
  leaveRoom: () => Promise<void>;
  sendMessage: (content: string, emoteIds?: string[], customEmojiIds?: string[]) => Promise<void>;
  sendTypingIndicator: (isTyping: boolean) => void;
  getActiveRooms: () => Promise<RoomMetadata[]>;
  clearMessages: () => void;
  destroy: () => void;
}

export function createChatStore(config: ChatStoreConfig) {
  return create<ChatStore>((set, get) => ({
    // Initial state
    room: null,
    messages: [],
    participants: [],
    typingUsers: new Map(),
    connectionState: {
      status: 'disconnected',
      roomId: null,
      peerId: null,
    },
    error: null,
    isInitialized: false,
    roomManager: null,
    
    initialize: (userId: string, userName: string) => {
      const existingManager = get().roomManager;
      if (existingManager) {
        existingManager.destroy();
      }
      
      const roomManager = new RoomManager({
        signalingBaseUrl: config.signalingBaseUrl,
        userId,
        userName,
        authenticatedFetch: config.authenticatedFetch,
        encrypt: config.encrypt,
        decrypt: config.decrypt,
        onMessage: (message) => {
          set((state) => ({
            messages: [...state.messages, message],
          }));
        },
        onConnectionStateChange: (connectionState) => {
          set({ connectionState });
        },
        onRoomChange: (room) => {
          set({ room });
        },
        onParticipantJoin: (userId) => {
          set((state) => ({
            participants: state.participants.includes(userId) 
              ? state.participants 
              : [...state.participants, userId],
          }));
        },
        onParticipantLeave: (userId) => {
          set((state) => ({
            participants: state.participants.filter((id) => id !== userId),
          }));
        },
        onTyping: (userId, userName, isTyping) => {
          set((state) => {
            const typingUsers = new Map(state.typingUsers);
            if (isTyping) {
              typingUsers.set(userId, userName);
            } else {
              typingUsers.delete(userId);
            }
            return { typingUsers };
          });
        },
        onError: (error) => {
          set({ error: error.message });
        },
      });
      
      set({ roomManager, isInitialized: true, error: null });
    },
    
    createRoom: async (customName) => {
      const { roomManager } = get();
      if (!roomManager) {
        throw new Error('Chat not initialized. Call initialize() first.');
      }
      
      set({ messages: [], participants: [], typingUsers: new Map() });
      return roomManager.createRoom(customName);
    },
    
    joinRoom: async (roomId) => {
      const { roomManager } = get();
      if (!roomManager) {
        throw new Error('Chat not initialized. Call initialize() first.');
      }
      
      set({ messages: [], participants: [], typingUsers: new Map() });
      return roomManager.joinRoom(roomId);
    },
    
    leaveRoom: async () => {
      const { roomManager } = get();
      if (!roomManager) return;
      
      await roomManager.leaveRoom();
      set({ 
        room: null, 
        messages: [], 
        participants: [], 
        typingUsers: new Map(),
      });
    },
    
    sendMessage: async (content, emoteIds, customEmojiIds) => {
      const { roomManager } = get();
      if (!roomManager) {
        throw new Error('Chat not initialized. Call initialize() first.');
      }
      
      await roomManager.sendMessage(content, emoteIds, customEmojiIds);
    },
    
    sendTypingIndicator: (isTyping) => {
      const { roomManager } = get();
      roomManager?.sendTypingIndicator(isTyping);
    },
    
    getActiveRooms: async () => {
      const { roomManager } = get();
      if (!roomManager) {
        throw new Error('Chat not initialized. Call initialize() first.');
      }
      
      return roomManager.getActiveRooms();
    },
    
    clearMessages: () => {
      set({ messages: [] });
    },
    
    destroy: () => {
      const { roomManager } = get();
      roomManager?.destroy();
      set({
        room: null,
        messages: [],
        participants: [],
        typingUsers: new Map(),
        connectionState: { status: 'disconnected', roomId: null, peerId: null },
        error: null,
        isInitialized: false,
        roomManager: null,
      });
    },
  }));
}

// Re-export types
export type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  RoomManagerConfig,
} from '../core/index.js';
