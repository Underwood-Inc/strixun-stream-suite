/**
 * Chat store for mods-hub
 * Uses the shared @strixun/chat package with Zustand adapter
 */

import { createChatStore } from '@strixun/chat/adapters/zustand';
import type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  ChatStore,
} from '@strixun/chat/adapters/zustand';

// Use Vite proxy in development, direct URL in production
// Follows the same pattern as auth store and other APIs
const CHAT_SIGNALING_URL = import.meta.env.VITE_CHAT_SIGNALING_URL
  ? import.meta.env.VITE_CHAT_SIGNALING_URL
  : (import.meta.env.DEV
    ? '/chat-api' // Vite proxy in development
    : 'https://chat-api.idling.app'); // Production API

// Create and export the chat store
export const useChatStore = createChatStore({
  signalingBaseUrl: CHAT_SIGNALING_URL,
  // Uses HttpOnly cookies for authentication automatically
});

// Re-export types for convenience
export type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  ChatStore,
};
