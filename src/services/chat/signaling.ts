/**
 * Signaling Server Client
 * 
 * Handles initial WebRTC connection setup via signaling server
 */

import { authenticatedFetch } from '../../stores/auth';
import type { RoomMetadata } from '../../types/chat';

export interface SignalingConfig {
  baseUrl: string;
  token: string;
}

export class SignalingService {
  private config: SignalingConfig;

  constructor(config: SignalingConfig) {
    this.config = config;
  }

  /**
   * Create a new room
   */
  async createRoom(broadcasterId: string, broadcasterName: string, customName?: string): Promise<RoomMetadata> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/create-room`, {
      method: 'POST',
      body: JSON.stringify({
        broadcasterId,
        broadcasterName,
        customName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create room: ${response.statusText}`);
    }

    const data = await response.json();
    return data.room;
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string, userId: string, userName: string): Promise<RoomMetadata> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/join-room`, {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        userId,
        userName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to join room: ${response.statusText}`);
    }

    const data = await response.json();
    return data.room;
  }

  /**
   * Send WebRTC offer to signaling server
   */
  async sendOffer(roomId: string, offer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/offer`, {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        offer: offer.sdp,
        type: offer.type,
        fromUserId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.statusText}`);
    }
  }

  /**
   * Poll for WebRTC offer from signaling server
   */
  async getOffer(roomId: string, timeout: number = 30000): Promise<RTCSessionDescriptionInit | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/offer/${roomId}`);

      if (response.status === 200) {
        const data = await response.json();
        return {
          type: 'offer',
          sdp: data.offer,
        };
      } else if (response.status === 404) {
        // No offer yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      } else {
        throw new Error(`Failed to get offer: ${response.statusText}`);
      }
    }

    return null; // Timeout
  }

  /**
   * Send WebRTC answer to signaling server
   */
  async sendAnswer(roomId: string, answer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/answer`, {
      method: 'POST',
      body: JSON.stringify({
        roomId,
        answer: answer.sdp,
        type: answer.type,
        fromUserId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send answer: ${response.statusText}`);
    }
  }

  /**
   * Poll for WebRTC answer from signaling server
   */
  async getAnswer(roomId: string, timeout: number = 30000): Promise<RTCSessionDescriptionInit | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/answer/${roomId}`);

      if (response.status === 200) {
        const data = await response.json();
        return {
          type: 'answer',
          sdp: data.answer,
        };
      } else if (response.status === 404) {
        // No answer yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      } else {
        throw new Error(`Failed to get answer: ${response.statusText}`);
      }
    }

    return null; // Timeout
  }

  /**
   * Send heartbeat to keep room alive
   */
  async sendHeartbeat(roomId: string): Promise<void> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });

    if (!response.ok) {
      console.warn(`Failed to send heartbeat: ${response.statusText}`);
    }
  }

  /**
   * Get list of active public rooms
   */
  async getActiveRooms(): Promise<RoomMetadata[]> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/rooms`);

    if (!response.ok) {
      throw new Error(`Failed to get rooms: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rooms || [];
  }

  /**
   * Leave room (cleanup on server)
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const response = await authenticatedFetch(`${this.config.baseUrl}/signaling/leave`, {
      method: 'POST',
      body: JSON.stringify({ roomId, userId }),
    });

    if (!response.ok) {
      console.warn(`Failed to leave room: ${response.statusText}`);
    }
  }
}

