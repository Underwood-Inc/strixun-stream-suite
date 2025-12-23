/**
 * Room Manager Service
 * 
 * Manages room lifecycle and connection flow
 */

import { WebRTCService, type WebRTCConfig } from './webrtc';
import { SignalingService, type SignalingConfig } from './signaling';
import { encrypt, decrypt, type EncryptedData } from '../../core/services/encryption';
import { getAuthToken } from '../../stores/auth';
import type { ChatMessage, RoomMetadata } from '../../types/chat';
import { chatState, addMessage, setRoom, setConnectionState, addParticipant, removeParticipant } from '../../stores/chat';

export interface RoomManagerConfig {
  signalingBaseUrl: string;
  token: string;
  userId: string;
  userName: string;
  onMessage?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
}

export class RoomManager {
  private webrtc: WebRTCService | null = null;
  private signaling: SignalingService;
  private config: RoomManagerConfig;
  private heartbeatInterval: number | null = null;
  private isCreator: boolean = false;

  constructor(config: RoomManagerConfig) {
    this.config = config;
    this.signaling = new SignalingService({
      baseUrl: config.signalingBaseUrl,
      token: config.token,
    });
  }

  /**
   * Create a new room as broadcaster
   */
  async createRoom(customName?: string): Promise<RoomMetadata> {
    try {
      // Create room on signaling server
      const room = await this.signaling.createRoom(
        this.config.userId,
        this.config.userName,
        customName
      );

      this.isCreator = true;
      setRoom(room);
      setConnectionState({
        status: 'connecting',
        roomId: room.roomId,
        peerId: null,
      });

      // Create WebRTC connection
      await this.setupWebRTC(room.roomId);

      // Create offer
      const offer = await this.webrtc!.createOffer();

      // Send offer to signaling server
      await this.signaling.sendOffer(room.roomId, offer, this.config.userId);

      // Start heartbeat
      this.startHeartbeat(room.roomId);

      return room;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create room');
      this.config.onError?.(err);
      setConnectionState({
        status: 'error',
        roomId: null,
        peerId: null,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string): Promise<RoomMetadata> {
    try {
      // Join room on signaling server
      const room = await this.signaling.joinRoom(roomId, this.config.userId, this.config.userName);

      this.isCreator = false;
      setRoom(room);
      setConnectionState({
        status: 'connecting',
        roomId: room.roomId,
        peerId: null,
      });

      // Create WebRTC connection
      await this.setupWebRTC(room.roomId);

      // Poll for offer
      const offer = await this.signaling.getOffer(room.roomId, 30000);

      if (!offer) {
        throw new Error('Failed to receive offer (timeout)');
      }

      // Set remote offer
      await this.webrtc!.setRemoteOffer(offer);

      // Create answer
      const answer = await this.webrtc!.createAnswer();

      // Send answer to signaling server
      await this.signaling.sendAnswer(room.roomId, answer, this.config.userId);

      // Start heartbeat
      this.startHeartbeat(room.roomId);

      return room;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to join room');
      this.config.onError?.(err);
      setConnectionState({
        status: 'error',
        roomId: null,
        peerId: null,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Setup WebRTC connection
   */
  private async setupWebRTC(roomId: string): Promise<void> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const webrtcConfig: WebRTCConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      onMessage: async (message: ChatMessage) => {
        // Decrypt message if encrypted
        if (message.encrypted && token) {
          try {
            // Decrypt message content
            const encryptedData = (message as any).encryptedData as EncryptedData;
            if (encryptedData) {
              const decrypted = await decrypt(encryptedData, token);
              message.content = typeof decrypted === 'string' ? decrypted : JSON.stringify(decrypted);
              message.encrypted = false;
            }
          } catch (error) {
            console.error('[RoomManager] Failed to decrypt message:', error);
            return;
          }
        }

        // Add participant if new
        addParticipant(message.senderId);

        // Call custom handler
        this.config.onMessage?.(message);

        // Add to store
        addMessage(message);
      },
      onConnectionStateChange: (state: RTCPeerConnectionState) => {
        if (state === 'connected') {
          setConnectionState({
            status: 'connected',
            roomId,
            peerId: this.webrtc?.getRoomId() || null,
          });
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionState({
            status: 'disconnected',
            roomId: null,
            peerId: null,
          });
        }
      },
      onError: (error: Error) => {
        this.config.onError?.(error);
      },
    };

    this.webrtc = new WebRTCService(this.config.userId, webrtcConfig);
    await this.webrtc.createConnection(roomId);

    // If creator, wait for answer
    if (this.isCreator) {
      this.waitForAnswer(roomId);
    }
  }

  /**
   * Wait for answer from joiner (creator side)
   */
  private async waitForAnswer(roomId: string): Promise<void> {
    try {
      const answer = await this.signaling.getAnswer(roomId, 30000);

      if (!answer) {
        throw new Error('Failed to receive answer (timeout)');
      }

      await this.webrtc!.setRemoteAnswer(answer);
    } catch (error) {
      console.error('[RoomManager] Failed to receive answer:', error);
      this.config.onError?.(error instanceof Error ? error : new Error('Answer timeout'));
    }
  }

  /**
   * Send message
   */
  async sendMessage(content: string, emoteIds?: string[], customEmojiIds?: string[]): Promise<void> {
    if (!this.webrtc || !this.webrtc.isConnected()) {
      throw new Error('Not connected to room');
    }

    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const room = chatState.room;
    if (!room) {
      throw new Error('No active room');
    }

    // Create message
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: room.roomId,
      senderId: this.config.userId,
      senderName: this.config.userName,
      timestamp: new Date().toISOString(),
      content,
      encrypted: false,
      emoteIds,
      customEmojiIds,
      type: 'message',
    };

    // Encrypt message
    try {
      const encrypted = await encrypt(message.content, token);
      message.encrypted = true;
      // Store encrypted data in message (will be decrypted on receive)
      (message as any).encryptedData = encrypted;
    } catch (error) {
      console.error('[RoomManager] Failed to encrypt message:', error);
      // Continue without encryption (fallback)
    }

    // Send via WebRTC
    this.webrtc.sendMessage(message);
  }

  /**
   * Start heartbeat to keep room alive
   */
  private startHeartbeat(roomId: string): void {
    this.stopHeartbeat();

    this.heartbeatInterval = window.setInterval(() => {
      this.signaling.sendHeartbeat(roomId).catch((error) => {
        console.error('[RoomManager] Heartbeat failed:', error);
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Leave room
   */
  async leaveRoom(): Promise<void> {
    const room = chatState.room;
    if (room) {
      await this.signaling.leaveRoom(room.roomId, this.config.userId);
    }

    this.stopHeartbeat();

    if (this.webrtc) {
      this.webrtc.cleanup();
      this.webrtc = null;
    }

    setConnectionState({
      status: 'disconnected',
      roomId: null,
      peerId: null,
    });

    setRoom(null);
  }

  /**
   * Get active rooms
   */
  async getActiveRooms(): Promise<RoomMetadata[]> {
    return this.signaling.getActiveRooms();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.webrtc?.isConnected() || false;
  }
}

