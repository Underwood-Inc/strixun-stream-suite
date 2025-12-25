/**
 * Room Splitting Service
 * 
 * Composable, agnostic service for opt-in room splitting (party rooms).
 * Allows users to create sub-rooms for better organization.
 * 
 * @module services/chat/roomSplitting
 */

import type { RoomMetadata, PartyRoomMetadata } from '../../types/chat';
import { authenticatedFetch } from '../../stores/auth';

export interface RoomSplittingConfig {
  /**
   * Signaling server base URL
   */
  signalingBaseUrl: string;
  
  /**
   * Current user ID
   */
  userId: string;
  
  /**
   * Current user display name
   */
  userName: string;
}

export interface CreatePartyRoomOptions {
  /**
   * Custom name for the party room
   */
  customName?: string;
  
  /**
   * Parent room ID (if splitting from existing room)
   */
  parentRoomId?: string;
  
  /**
   * User IDs to invite to the party room
   */
  invitedUsers?: string[];
}

/**
 * Room Splitting Service
 * 
 * Handles opt-in room splitting for party organization
 */
export class RoomSplittingService {
  private config: RoomSplittingConfig;

  constructor(config: RoomSplittingConfig) {
    this.config = config;
  }

  /**
   * Create a party room (opt-in room splitting)
   * 
   * @param options - Party room creation options
   * @returns Created party room metadata
   */
  async createPartyRoom(options: CreatePartyRoomOptions = {}): Promise<PartyRoomMetadata> {
    const { customName, parentRoomId, invitedUsers } = options;

    const response = await authenticatedFetch(
      `${this.config.signalingBaseUrl}/signaling/create-party-room`,
      {
        method: 'POST',
        body: JSON.stringify({
          broadcasterId: this.config.userId,
          broadcasterName: this.config.userName,
          customName,
          parentRoomId,
          invitedUsers: invitedUsers || [],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create party room');
    }

    const data = await response.json();
    return {
      ...data.room,
      isPartyRoom: true,
      createdBy: this.config.userId,
      invitedUsers: invitedUsers || [],
    };
  }

  /**
   * Get party rooms for a parent room
   * 
   * @param parentRoomId - Parent room ID
   * @returns List of party rooms
   */
  async getPartyRooms(parentRoomId: string): Promise<PartyRoomMetadata[]> {
    const response = await authenticatedFetch(
      `${this.config.signalingBaseUrl}/signaling/party-rooms/${parentRoomId}`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get party rooms');
    }

    const data = await response.json();
    return data.rooms || [];
  }

  /**
   * Invite users to a party room
   * 
   * @param partyRoomId - Party room ID
   * @param userIds - User IDs to invite
   */
  async inviteToPartyRoom(partyRoomId: string, userIds: string[]): Promise<void> {
    const response = await authenticatedFetch(
      `${this.config.signalingBaseUrl}/signaling/party-room/${partyRoomId}/invite`,
      {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite users');
    }
  }
}

