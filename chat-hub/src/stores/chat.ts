/**
 * Chat store for chat-hub
 * Uses the shared @strixun/chat package with Zustand adapter
 */

import { createChatStore } from '@strixun/chat/adapters/zustand';
import type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  ChatStore,
} from '@strixun/chat/adapters/zustand';

// Use appropriate URL based on environment
// API at chat-api.idling.app, frontend at chat.idling.app
const CHAT_SIGNALING_URL = import.meta.env.VITE_CHAT_SIGNALING_URL
  ? import.meta.env.VITE_CHAT_SIGNALING_URL
  : (import.meta.env.DEV
    ? '/chat-api' // Vite proxy in development
    : 'https://chat-api.idling.app'); // Production API

// Create and export the chat store
export const useChatStore = createChatStore({
  signalingBaseUrl: CHAT_SIGNALING_URL,
});

// Re-export types for convenience
export type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  ChatStore,
};
