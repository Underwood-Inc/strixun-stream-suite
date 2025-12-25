/**
 * Room Utilities
 * 
 * Room ID generation and management
 */

/**
 * Generate room ID
 */
export function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

