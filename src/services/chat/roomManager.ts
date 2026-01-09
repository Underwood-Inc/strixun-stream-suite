/**
 * Room Manager Service
 * 
 * Manages room lifecycle and connection flow
 */

import { get } from 'svelte/store';
import { decrypt, encrypt, type EncryptedData } from '../../core/services/encryption';
import { getAuthToken } from '../../stores/auth';
import { addMessage, addParticipant, chatState, removeParticipant, removeTyping, setConnectionState, setRoom, setTyping } from '../../stores/chat';
import type { ChatMessage, RoomMetadata } from '../../types/chat';
import { MessageHistoryService } from './messageHistory';
import { ReconnectionService } from './reconnection';
import { SignalingService } from './signaling';
import { WebRTCService, type WebRTCConfig } from './webrtc';

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
  private messageHistory: MessageHistoryService | null = null;
  private reconnectionService: ReconnectionService | null = null;

  constructor(config: RoomManagerConfig) {
    this.config = config;
    this.signaling = new SignalingService({
      baseUrl: config.signalingBaseUrl,
      token: config.token,
    });
    
    // Initialize message history service
    const token = getAuthToken();
    if (token) {
      this.messageHistory = new MessageHistoryService({
        encryptionToken: token,
      });
    }
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

      // Load message history for this room
      if (this.messageHistory) {
        try {
          const history = await this.messageHistory.loadHistory(roomId, 100);
          // Add historical messages to store (in chronological order)
          history.forEach(msg => addMessage(msg));
        } catch (error) {
          console.error('[RoomManager] Failed to load message history:', error);
          // Continue without history
        }
      }

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
    const authToken = getAuthToken();
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const webrtcConfig: WebRTCConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      onTyping: (userId: string, _userName: string, isTyping: boolean) => {
        // Update typing indicators in store
        if (isTyping) {
          setTyping(userId, _userName);
        } else {
          removeTyping(userId);
        }
      },
      onPresence: (customerId: string, _customerName: string, status: 'online' | 'offline' | 'away') => {
        // Update customer presence
        if (status === 'online') {
          addParticipant(customerId);
        } else if (status === 'offline') {
          removeParticipant(userId);
        }
        // TODO: Add presence status tracking (online/away/offline)
      },
      onMessage: async (message: ChatMessage) => {
        // Decrypt message if encrypted
        if (message.encrypted && authToken) {
          try {
            // Decrypt message content
            const encryptedData = (message as any).encryptedData as EncryptedData;
            if (encryptedData) {
              const decrypted = await decrypt(encryptedData, authToken);
              message.content = typeof decrypted === 'string' ? decrypted : JSON.stringify(decrypted);
              message.encrypted = false;
            }
          } catch (error) {
            console.error('[RoomManager] Failed to decrypt message:', error);
            return;
          }
        }

        // Save to message history
        if (this.messageHistory) {
          this.messageHistory.saveMessage(message).catch((error) => {
            console.error('[RoomManager] Failed to save message to history:', error);
          });
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
          // Stop reconnection on successful connection
          if (this.reconnectionService) {
            this.reconnectionService.reset();
          }

          setConnectionState({
            status: 'connected',
            roomId,
            peerId: this.webrtc?.getRoomId() || null,
          });

          // Send presence update
          this.sendPresence('online');
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionState({
            status: state === 'failed' ? 'error' : 'disconnected',
            roomId: state === 'failed' ? null : roomId,
            peerId: null,
            error: state === 'failed' ? 'Connection failed' : undefined,
          });

          // Start reconnection if disconnected
          if (state === 'disconnected' && this.reconnectionService) {
            this.reconnectionService.start().catch((error) => {
              console.error('[RoomManager] Reconnection failed:', error);
            });
          }
        } else if (state === 'connecting') {
          setConnectionState({
            status: 'connecting',
            roomId,
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

    // Initialize reconnection service
    const reconnectToken = getAuthToken();
    if (reconnectToken) {
      this.reconnectionService = new ReconnectionService({
        initialDelay: 1000,
        maxDelay: 30000,
        maxAttempts: 10,
        onReconnect: async () => {
          // Attempt to rejoin the room
          const state = get(chatState);
          const currentRoom = state.room;
          if (currentRoom) {
            await this.joinRoom(currentRoom.roomId);
          } else {
            throw new Error('No room to reconnect to');
          }
        },
        onReconnectSuccess: () => {
          console.log('[RoomManager] Reconnection successful');
          this.config.onError?.(new Error('Reconnected successfully'));
        },
        onReconnectFailure: (error) => {
          console.error('[RoomManager] Reconnection failed permanently:', error);
          this.config.onError?.(error);
        },
        onRestoreState: async () => {
          // Restore room state if needed
          // This could reload message history, etc.
        },
      });
    }

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
   * Send typing indicator
   */
  sendTypingIndicator(isTyping: boolean): void {
    if (!this.webrtc || !this.webrtc.isConnected()) {
      return; // Silently fail if not connected
    }

    this.webrtc.sendTypingIndicator(isTyping, this.config.userName);
  }

  /**
   * Send presence update
   */
  sendPresence(status: 'online' | 'offline' | 'away'): void {
    if (!this.webrtc || !this.webrtc.isConnected()) {
      return; // Silently fail if not connected
    }

    this.webrtc.sendPresence(status, this.config.userName);
  }

  /**
   * Send message
   */
  async sendMessage(content: string, emoteIds?: string[], customEmojiIds?: string[]): Promise<void> {
    if (!this.webrtc || !this.webrtc.isConnected()) {
      throw new Error('Not connected to room');
    }

    const authToken = getAuthToken();
    if (!authToken) {
      throw new Error('Not authenticated');
    }

    const room = get(chatState).room;
    if (!room) {
      throw new Error('No active room');
    }

    // Create message
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: room.roomId,
      senderId: this.config.userId,
      senderName: this.config.userName, // This is now displayName from store
      senderDisplayName: this.config.userName, // Explicit display name field
      timestamp: new Date().toISOString(),
      content,
      encrypted: false,
      emoteIds,
      customEmojiIds,
      type: 'message',
    };

    // Encrypt message
    if (authToken) {
      try {
        const encrypted = await encrypt(message.content, authToken);
        message.encrypted = true;
        // Store encrypted data in message (will be decrypted on receive)
        (message as any).encryptedData = encrypted;
      } catch (error) {
        console.error('[RoomManager] Failed to encrypt message:', error);
        // Continue without encryption (fallback)
      }
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
    const state = get(chatState);
    const room = state.room;
    if (room) {
      // Send offline presence
      this.sendPresence('offline');
      
      await this.signaling.leaveRoom(room.roomId, this.config.userId);
    }

    this.stopHeartbeat();

    // Stop reconnection service
    if (this.reconnectionService) {
      this.reconnectionService.stop();
      this.reconnectionService = null;
    }

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

  /**
   * Load message history for current room
   * 
   * @param limit - Maximum number of messages to load
   * @returns Historical messages
   */
  async loadMessageHistory(limit: number = 100): Promise<ChatMessage[]> {
    const state = get(chatState);
    const room = state.room;
    if (!room || !this.messageHistory) {
      return [];
    }

    try {
      return await this.messageHistory.loadHistory(room.roomId, limit);
    } catch (error) {
      console.error('[RoomManager] Failed to load message history:', error);
      return [];
    }
  }

  /**
   * Clear message history for current room
   */
  async clearMessageHistory(): Promise<void> {
    const state = get(chatState);
    const room = state.room;
    if (!room || !this.messageHistory) {
      return;
    }

    try {
      await this.messageHistory.clearHistory(room.roomId);
    } catch (error) {
      console.error('[RoomManager] Failed to clear message history:', error);
      throw error;
    }
  }

  /**
   * Get message count for current room
   */
  async getMessageCount(): Promise<number> {
    const state = get(chatState);
    const room = state.room;
    if (!room || !this.messageHistory) {
      return 0;
    }

    try {
      return await this.messageHistory.getMessageCount(room.roomId);
    } catch (error) {
      console.error('[RoomManager] Failed to get message count:', error);
      return 0;
    }
  }
}

