/**
 * @strixun/chat - P2P Chat Client Library
 * 
 * Framework-agnostic P2P chat client with WebRTC signaling.
 * 
 * Usage:
 * 
 * For React/Zustand:
 * ```ts
 * import { createChatStore } from '@strixun/chat/zustand';
 * import { ChatClient } from '@strixun/chat/react';
 * 
 * const useChatStore = createChatStore({
 *   signalingBaseUrl: 'https://chat-api.idling.app',
 * });
 * ```
 * 
 * For vanilla JS:
 * ```ts
 * import { RoomManager } from '@strixun/chat/core';
 * 
 * const roomManager = new RoomManager({
 *   signalingBaseUrl: 'https://chat-api.idling.app',
 *   userId: 'user-123',
 *   userName: 'John',
 *   onMessage: (msg) => console.log(msg),
 * });
 * ```
 */

export * from './core/index.js';
