/**
 * Type Definitions for Chat Signaling Worker
 * 
 * Central type definitions for all handlers, utilities, and router
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Worker Environment Variables
 */
export interface Env {
  /** Chat KV Namespace for room metadata */
  CHAT_KV: KVNamespace;
  
  /** JWT Secret (shared with OTP auth service) */
  JWT_SECRET: string;
  
  /** Allowed CORS origins (comma-separated) */
  ALLOWED_ORIGINS?: string;
  
  /** Environment name (production, development, etc.) */
  ENVIRONMENT?: string;
}

/**
 * Room Metadata
 */
export interface RoomMetadata {
  roomId: string;
  broadcasterId: string;
  broadcasterName: string;
  createdAt: string;
  participantCount: number;
  isPublic: boolean;
  customName?: string;
  lastActivity?: number;
  /** Encrypted room key (for P2P E2E encryption) */
  encryptedRoomKey?: string;
  /** Hash of room key for verification */
  keyHash?: string;
  /** Room key version for rotation */
  keyVersion?: number;
}

/**
 * Party Room Metadata (opt-in room splitting)
 */
export interface PartyRoomMetadata extends RoomMetadata {
  isPartyRoom: boolean;
  parentRoomId?: string;
  createdBy: string;
  invitedUsers?: string[];
}

/**
 * Authentication Result
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  email?: string;
  customerId?: string;
  jwtToken?: string;
  status?: number;
  error?: string;
}

/**
 * JWT Payload
 */
export interface JWTPayload {
  sub: string; // Subject (customerId)
  iss: string; // Issuer
  aud: string; // Audience
  exp: number; // Expiration
  iat: number; // Issued at
  jti: string; // JWT ID
  email: string;
  email_verified: boolean;
  customerId: string;
  csrf: string;
  isSuperAdmin: boolean;
}

/**
 * Create Room Request Body
 */
export interface CreateRoomRequest {
  broadcasterId: string;
  broadcasterName: string;
  customName?: string;
  /** Encrypted room key (for P2P E2E encryption) */
  encryptedRoomKey?: string;
  /** Hash of room key for verification */
  keyHash?: string;
}

/**
 * Join Room Request Body
 */
export interface JoinRoomRequest {
  roomId: string;
  userId?: string;
  userName?: string;
}

/**
 * Send Offer Request Body
 */
export interface SendOfferRequest {
  roomId: string;
  offer: string;
  type: string;
  fromUserId?: string;
}

/**
 * Send Answer Request Body
 */
export interface SendAnswerRequest {
  roomId: string;
  answer: string;
  type: string;
  fromUserId?: string;
}

/**
 * Heartbeat Request Body
 */
export interface HeartbeatRequest {
  roomId: string;
}

/**
 * Leave Room Request Body
 */
export interface LeaveRoomRequest {
  roomId: string;
  userId?: string;
}

/**
 * Create Party Room Request Body
 */
export interface CreatePartyRoomRequest {
  broadcasterId: string;
  broadcasterName: string;
  customName?: string;
  parentRoomId?: string;
  invitedUsers?: string[];
}

/**
 * Invite to Party Room Request Body
 */
export interface InviteToPartyRoomRequest {
  userIds: string[];
}

/**
 * CORS Headers
 */
export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': string;
  'Access-Control-Max-Age': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Content-Security-Policy': string;
}

/**
 * Standard Success Response
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  message?: string;
}

/**
 * Standard Error Response
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}
