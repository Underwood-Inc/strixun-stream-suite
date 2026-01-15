/**
 * Input Validation Schemas
 * 
 * Zod schemas for validating request bodies and preventing XSS/injection attacks
 * @module utils/validation
 */

import { z } from 'zod';

/**
 * Room name validation
 * - Max 100 characters
 * - Alphanumeric, spaces, hyphens, underscores only
 */
const roomNameSchema = z
  .string()
  .max(100, 'Room name must be 100 characters or less')
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    'Room name can only contain letters, numbers, spaces, hyphens, and underscores'
  )
  .optional();

/**
 * User ID validation
 * - Max 255 characters
 * - Alphanumeric, hyphens, underscores only
 */
const userIdSchema = z
  .string()
  .max(255, 'User ID must be 255 characters or less')
  .regex(
    /^[a-zA-Z0-9\-_]+$/,
    'User ID can only contain letters, numbers, hyphens, and underscores'
  );

/**
 * User name validation
 * - Max 100 characters
 * - Alphanumeric, spaces, hyphens, underscores only
 */
const userNameSchema = z
  .string()
  .max(100, 'User name must be 100 characters or less')
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    'User name can only contain letters, numbers, spaces, hyphens, and underscores'
  );

/**
 * Room ID validation
 * - Must start with "room_"
 * - Max 255 characters
 */
const roomIdSchema = z
  .string()
  .max(255, 'Room ID must be 255 characters or less')
  .regex(/^room_[a-zA-Z0-9_]+$/, 'Invalid room ID format');

/**
 * WebRTC SDP validation
 * - Max 50KB (reasonable limit for SDP)
 * - Must contain "v=0" (SDP version)
 */
const sdpSchema = z
  .string()
  .max(50000, 'SDP must be 50KB or less')
  .refine(
    (sdp) => sdp.includes('v=0'),
    'Invalid SDP format'
  );

/**
 * Create Room Request Schema
 */
export const createRoomSchema = z.object({
  broadcasterId: userIdSchema,
  broadcasterName: userNameSchema,
  customName: roomNameSchema,
});

/**
 * Join Room Request Schema
 */
export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  userId: userIdSchema.optional(),
  userName: userNameSchema.optional(),
});

/**
 * Send Offer Request Schema
 */
export const sendOfferSchema = z.object({
  roomId: roomIdSchema,
  offer: sdpSchema,
  type: z.literal('offer'),
  fromUserId: userIdSchema.optional(),
});

/**
 * Send Answer Request Schema
 */
export const sendAnswerSchema = z.object({
  roomId: roomIdSchema,
  answer: sdpSchema,
  type: z.literal('answer'),
  fromUserId: userIdSchema.optional(),
});

/**
 * Heartbeat Request Schema
 */
export const heartbeatSchema = z.object({
  roomId: roomIdSchema,
});

/**
 * Leave Room Request Schema
 */
export const leaveRoomSchema = z.object({
  roomId: roomIdSchema,
  userId: userIdSchema.optional(),
});

/**
 * Create Party Room Request Schema
 */
export const createPartyRoomSchema = z.object({
  broadcasterId: userIdSchema,
  broadcasterName: userNameSchema,
  customName: roomNameSchema,
  parentRoomId: roomIdSchema.optional(),
  invitedUsers: z.array(userIdSchema).max(50, 'Maximum 50 invited users').optional(),
});

/**
 * Invite to Party Room Request Schema
 */
export const inviteToPartyRoomSchema = z.object({
  userIds: z.array(userIdSchema).min(1, 'At least one user ID required').max(50, 'Maximum 50 users per invitation'),
});

/**
 * Validate request body against schema
 * 
 * @param data - Data to validate
 * @param schema - Zod schema
 * @returns Validation result with parsed data or error
 */
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; details: z.ZodError } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format error message from Zod errors
      const errorMessage = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      
      return { 
        success: false, 
        error: errorMessage,
        details: error,
      };
    }
    
    return { 
      success: false, 
      error: 'Validation failed',
      details: error as z.ZodError,
    };
  }
}

/**
 * Sanitize string to prevent XSS
 * 
 * Removes potentially dangerous characters and HTML tags
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>'"]/g, '') // Remove HTML-like characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}
