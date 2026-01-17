/**
 * Signaling Server Client
 * 
 * Framework-agnostic signaling service for WebRTC connection setup
 * Accepts a fetch function for authentication flexibility
 */

import type { AuthenticatedFetchFn, RoomMetadata } from './types.js';

export interface SignalingConfig {
  baseUrl: string;
  /** 
   * Authenticated fetch function that handles credentials.
   * If not provided, uses regular fetch (for cookie-based auth).
   */
  authenticatedFetch?: AuthenticatedFetchFn;
}

export class SignalingService {
  private config: SignalingConfig;
  private fetch: AuthenticatedFetchFn;

  constructor(config: SignalingConfig) {
    this.config = config;
    // Use provided fetch or default to regular fetch with credentials
    this.fetch = config.authenticatedFetch || ((url, options) => 
      fetch(url, { 
        ...options, 
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    );
  }

  async createRoom(broadcasterId: string, broadcasterName: string, customName?: string): Promise<RoomMetadata> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/create-room`, {
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

  async joinRoom(roomId: string, userId: string, userName: string): Promise<RoomMetadata> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/join-room`, {
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

  async sendOffer(roomId: string, offer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/offer`, {
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

  async getOffer(roomId: string, timeout: number = 30000): Promise<RTCSessionDescriptionInit | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.fetch(`${this.config.baseUrl}/signaling/offer/${roomId}`);

      if (response.status === 200) {
        const data = await response.json();
        return {
          type: 'offer',
          sdp: data.offer,
        };
      } else if (response.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      } else {
        throw new Error(`Failed to get offer: ${response.statusText}`);
      }
    }

    return null;
  }

  async sendAnswer(roomId: string, answer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/answer`, {
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

  async getAnswer(roomId: string, timeout: number = 30000): Promise<RTCSessionDescriptionInit | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = await this.fetch(`${this.config.baseUrl}/signaling/answer/${roomId}`);

      if (response.status === 200) {
        const data = await response.json();
        return {
          type: 'answer',
          sdp: data.answer,
        };
      } else if (response.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      } else {
        throw new Error(`Failed to get answer: ${response.statusText}`);
      }
    }

    return null;
  }

  async sendHeartbeat(roomId: string): Promise<void> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ roomId }),
    });

    if (!response.ok) {
      console.warn(`Failed to send heartbeat: ${response.statusText}`);
    }
  }

  async getActiveRooms(): Promise<RoomMetadata[]> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/rooms`);

    if (!response.ok) {
      throw new Error(`Failed to get rooms: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rooms || [];
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const response = await this.fetch(`${this.config.baseUrl}/signaling/leave`, {
      method: 'POST',
      body: JSON.stringify({ roomId, userId }),
    });

    if (!response.ok) {
      console.warn(`Failed to leave room: ${response.statusText}`);
    }
  }
}
