/**
 * Zustand Adapter for @strixun/chat
 * 
 * Provides a Zustand store for React applications with P2P persistence.
 */

import { create } from 'zustand';
import { 
  SecureRoomManager, 
  type SecureRoomManagerConfig,
} from '../core/secure-room-manager.js';
import type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
} from '../core/types.js';
import type { StorageAdapter, IntegrityInfo } from '@strixun/p2p-storage';

export interface ChatStoreConfig {
  signalingBaseUrl: string;
  /** Override fetch function for authentication */
  authenticatedFetch?: SecureRoomManagerConfig['authenticatedFetch'];
  /** Encryption functions */
  encrypt?: SecureRoomManagerConfig['encrypt'];
  decrypt?: SecureRoomManagerConfig['decrypt'];
  /** Custom storage adapter (defaults to IndexedDB) */
  storageAdapter?: StorageAdapter;
  /** Enable P2P persistence (defaults to true) */
  enablePersistence?: boolean;
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
  
  // P2P Storage State
  integrityInfo: IntegrityInfo | null;
  peerCount: number;
  
  // Room manager instance (internal)
  roomManager: SecureRoomManager | null;
  
  // Actions
  initialize: (userId: string, userName: string) => void;
  createRoom: (customName?: string) => Promise<RoomMetadata>;
  joinRoom: (roomId: string) => Promise<RoomMetadata>;
  leaveRoom: () => Promise<void>;
  sendMessage: (content: string, emoteIds?: string[], customEmojiIds?: string[]) => Promise<void>;
  sendTypingIndicator: (isTyping: boolean) => void;
  getActiveRooms: () => Promise<RoomMetadata[]>;
  clearMessages: () => void;
  forceSync: () => Promise<void>;
  getIntegrityInfo: () => Promise<IntegrityInfo | null>;
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
    
    // P2P Storage State
    integrityInfo: null,
    peerCount: 0,
    
    roomManager: null,
    
    initialize: (userId: string, userName: string) => {
      const existingManager = get().roomManager;
      if (existingManager) {
        existingManager.destroy();
      }
      
      const roomManager = new SecureRoomManager({
        signalingBaseUrl: config.signalingBaseUrl,
        userId,
        userName,
        authenticatedFetch: config.authenticatedFetch,
        encrypt: config.encrypt,
        decrypt: config.decrypt,
        storageAdapter: config.storageAdapter,
        onMessage: (message: ChatMessage) => {
          set((state) => {
            // Deduplicate messages by ID
            const exists = state.messages.some(m => m.id === message.id);
            if (exists) return state;
            return {
              messages: [...state.messages, message],
            };
          });
        },
        onConnectionStateChange: (connectionState: ChatConnectionState) => {
          set({ connectionState });
        },
        onRoomChange: (room: RoomMetadata | null) => {
          set({ room });
        },
        onParticipantJoin: (participantId: string) => {
          set((state) => ({
            participants: state.participants.includes(participantId) 
              ? state.participants 
              : [...state.participants, participantId],
          }));
        },
        onParticipantLeave: (participantId: string) => {
          set((state) => ({
            participants: state.participants.filter((id) => id !== participantId),
          }));
        },
        onTyping: (typingUserId: string, typingUserName: string, isTyping: boolean) => {
          set((state) => {
            const typingUsers = new Map(state.typingUsers);
            if (isTyping) {
              typingUsers.set(typingUserId, typingUserName);
            } else {
              typingUsers.delete(typingUserId);
            }
            return { typingUsers };
          });
        },
        onError: (error: Error) => {
          set({ error: error.message });
        },
        onIntegrityChange: (integrityInfo: IntegrityInfo) => {
          set({ integrityInfo });
        },
        onPeerCountChange: (peerCount: number) => {
          set({ peerCount });
        },
        onHistoryLoaded: (messages: ChatMessage[]) => {
          set((state) => ({
            messages: [...messages, ...state.messages],
          }));
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
        integrityInfo: null,
        peerCount: 0,
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
    
    forceSync: async () => {
      const { roomManager } = get();
      if (!roomManager) return;
      await roomManager.forceSync();
    },
    
    getIntegrityInfo: async () => {
      const { roomManager } = get();
      if (!roomManager) return null;
      return roomManager.getIntegrityInfo();
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
        integrityInfo: null,
        peerCount: 0,
      });
    },
  }));
}

// Re-export types
export type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
} from '../core/types.js';

export type { SecureRoomManagerConfig as RoomManagerConfig } from '../core/secure-room-manager.js';

export type { StorageAdapter, IntegrityInfo } from '@strixun/p2p-storage';
