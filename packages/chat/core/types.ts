/**
 * Chat System Type Definitions
 * 
 * Framework-agnostic types for the P2P chat client system
 */

export interface RoomMetadata {
  roomId: string;
  broadcasterId: string;
  broadcasterName: string;
  createdAt: string;
  participantCount: number;
  isPublic: boolean;
  customName?: string;
}

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

export interface ChatConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  roomId: string | null;
  peerId: string | null;
  error?: string;
}

export interface RoomInfo {
  metadata: RoomMetadata;
  participants: string[];
  messageCount: number;
}

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

export interface PartyRoomMetadata extends RoomMetadata {
  parentRoomId?: string;
  isPartyRoom: boolean;
  createdBy: string;
  invitedUsers?: string[];
}

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

/**
 * Fetch function type for making authenticated requests
 * Allows injection of different auth mechanisms (cookies, tokens, etc.)
 */
export type AuthenticatedFetchFn = (
  url: string,
  options?: RequestInit
) => Promise<Response>;
