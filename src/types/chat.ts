/**
 * Chat System Type Definitions
 * 
 * Types for the P2P chat client system
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
  timestamp: string;
  content: string;
  encrypted: boolean;
  emoteIds?: string[];
  customEmojiIds?: string[];
  type?: 'message' | 'system' | 'join' | 'leave';
}

export interface EncryptedChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  timestamp: string;
  encrypted: EncryptedData;
  emoteIds?: string[];
  customEmojiIds?: string[];
  type?: 'message' | 'system' | 'join' | 'leave';
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

