/**
 * Chat System Type Definitions
 * 
 * Framework-agnostic types for the P2P chat client system.
 * 
 * For blockchain storage, use @strixun/p2p-storage directly.
 * This module contains chat-specific types only.
 */

// ============ Room Types ============

export interface RoomMetadata {
  roomId: string;
  broadcasterId: string;
  broadcasterName: string;
  createdAt: string;
  participantCount: number;
  isPublic: boolean;
  customName?: string;
}

export interface PartyRoomMetadata extends RoomMetadata {
  parentRoomId?: string;
  isPartyRoom: boolean;
  createdBy: string;
  invitedUsers?: string[];
}

export interface RoomInfo {
  metadata: RoomMetadata;
  participants: string[];
  messageCount: number;
}

// ============ Message Types ============

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderDisplayName?: string;
  timestamp: string;
  content: string;
  encrypted: boolean;
  emoteIds?: string[];
  customEmojiIds?: string[];
  type?: 'message' | 'system' | 'join' | 'leave' | 'typing' | 'typing_stop' | 'presence';
}

export interface TypingEvent {
  type: 'typing' | 'typing_stop';
  userId: string;
  userName: string;
  roomId: string;
  timestamp: string;
}

export interface PresenceEvent {
  type: 'presence';
  userId: string;
  userName: string;
  roomId: string;
  status: 'online' | 'offline' | 'away';
  timestamp: string;
}

// ============ Emote Types ============

export interface EmoteData {
  id: string;
  name: string;
  url: string;
  animated: boolean;
  width: number;
  height: number;
  provider: '7tv' | 'custom';
}

export interface CustomEmoji {
  id: string;
  name: string;
  url: string;
  domain: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ============ WebRTC Types ============

export interface WebRTCOffer {
  type: 'offer';
  sdp: string;
  roomId: string;
  fromUserId: string;
}

export interface WebRTCAnswer {
  type: 'answer';
  sdp: string;
  roomId: string;
  fromUserId: string;
}

export interface WebRTCIceCandidate {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit;
  roomId: string;
  fromUserId: string;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'room-created' | 'room-joined' | 'error';
  data: WebRTCOffer | WebRTCAnswer | WebRTCIceCandidate | RoomMetadata | { error: string };
}

// ============ Connection State ============

export interface ChatConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  roomId: string | null;
  peerId: string | null;
  error?: string;
}

// ============ User Types ============

export interface ChatUserProfile {
  userId: string;
  displayName: string;
  email?: string;
  customerId?: string;
  twitchAccount?: {
    userId: string;
    username: string;
    attachedAt: string;
  };
}

// ============ Chat State ============

/**
 * Chat state for state management
 */
export interface ChatState {
  room: RoomMetadata | null;
  messages: ChatMessage[];
  participants: Set<string>;
  isTyping: Map<string, string>;
  connectionState: ChatConnectionState;
}

// ============ Auth Types ============

/**
 * Fetch function type for making authenticated requests
 * Allows injection of different auth mechanisms (cookies, tokens, etc.)
 */
export type AuthenticatedFetchFn = (
  url: string,
  options?: RequestInit
) => Promise<Response>;

// ============ Encryption Types ============

/**
 * Encrypted data envelope
 * Compatible with @strixun/api-framework and @strixun/p2p-storage
 */
export interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string;
  salt: string;
  tokenHash?: string;
  passwordProtected: boolean;
  data: string;
  timestamp: string;
}

// ============ P2P Protocol Types ============

/**
 * P2P protocol message types sent over WebRTC data channels
 */
export type P2PProtocolMessage = 
  | { type: 'sync_request'; roomId: string; lastSyncVersion: number; lastTimestamp: number; requesterId: string }
  | { type: 'sync_response'; roomId: string; batchHash: string; hasMore: boolean; responderId: string }
  | { type: 'room_key_request'; roomId: string; requesterId: string }
  | { type: 'room_key_response'; roomId: string; keyHash: string; senderId: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'presence'; userId: string; userName: string; status: 'online' | 'offline' | 'away' };
