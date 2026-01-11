/**
 * Room Utilities
 * 
 * Room ID generation and management utilities
 * @module utils/room
 */

/**
 * Generate a unique room ID
 * 
 * Format: room_{timestamp}_{random}
 * Example: room_1704067200000_abc123xyz
 * 
 * @returns Unique room identifier
 */
export function generateRoomId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `room_${timestamp}_${random}`;
}
