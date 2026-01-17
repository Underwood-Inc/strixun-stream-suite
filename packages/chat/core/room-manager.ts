/**
 * Room Manager Service
 * 
 * Framework-agnostic room lifecycle and connection management
 * Uses callbacks instead of framework-specific stores
 */

import type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  AuthenticatedFetchFn,
  EncryptedData 
} from './types.js';
import { SignalingService } from './signaling.js';
import { WebRTCService, type WebRTCConfig } from './webrtc.js';

export interface RoomManagerConfig {
  signalingBaseUrl: string;
  userId: string;
  userName: string;
  /** Authenticated fetch function (optional - uses cookies by default) */
  authenticatedFetch?: AuthenticatedFetchFn;
  /** Encryption functions (optional) */
  encrypt?: (content: string) => Promise<EncryptedData>;
  decrypt?: (data: EncryptedData) => Promise<string>;
  /** Callbacks */
  onMessage?: (message: ChatMessage) => void;
  onConnectionStateChange?: (state: ChatConnectionState) => void;
  onRoomChange?: (room: RoomMetadata | null) => void;
  onParticipantJoin?: (userId: string) => void;
  onParticipantLeave?: (userId: string) => void;
  onTyping?: (userId: string, userName: string, isTyping: boolean) => void;
  onPresence?: (userId: string, userName: string, status: 'online' | 'offline' | 'away') => void;
  onError?: (error: Error) => void;
}

export class RoomManager {
  private webrtc: WebRTCService | null = null;
  private signaling: SignalingService;
  private config: RoomManagerConfig;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isCreator: boolean = false;
  private currentRoom: RoomMetadata | null = null;
  private connectionState: ChatConnectionState = {
    status: 'disconnected',
    roomId: null,
    peerId: null,
  };

  constructor(config: RoomManagerConfig) {
    this.config = config;
    this.signaling = new SignalingService({
      baseUrl: config.signalingBaseUrl,
      authenticatedFetch: config.authenticatedFetch,
    });
  }

  /**
   * Create a new room as broadcaster
   */
  async createRoom(customName?: string): Promise<RoomMetadata> {
    try {
      const room = await this.signaling.createRoom(
        this.config.userId,
        this.config.userName,
        customName
      );

      this.isCreator = true;
      this.currentRoom = room;
      this.config.onRoomChange?.(room);
      
      this.setConnectionState({
        status: 'connecting',
        roomId: room.roomId,
        peerId: null,
      });

      await this.setupWebRTC(room.roomId);
      const offer = await this.webrtc!.createOffer();
      await this.signaling.sendOffer(room.roomId, offer, this.config.userId);
      this.startHeartbeat(room.roomId);

      return room;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create room');
      this.config.onError?.(err);
      this.setConnectionState({
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
      const room = await this.signaling.joinRoom(
        roomId, 
        this.config.userId, 
        this.config.userName
      );

      this.isCreator = false;
      this.currentRoom = room;
      this.config.onRoomChange?.(room);
      
      this.setConnectionState({
        status: 'connecting',
        roomId: room.roomId,
        peerId: null,
      });

      await this.setupWebRTC(room.roomId);
      const offer = await this.signaling.getOffer(room.roomId, 30000);

      if (!offer) {
        throw new Error('Failed to receive offer (timeout)');
      }

      await this.webrtc!.setRemoteOffer(offer);
      const answer = await this.webrtc!.createAnswer();
      await this.signaling.sendAnswer(room.roomId, answer, this.config.userId);
      this.startHeartbeat(room.roomId);

      return room;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to join room');
      this.config.onError?.(err);
      this.setConnectionState({
        status: 'error',
        roomId: null,
        peerId: null,
        error: err.message,
      });
      throw err;
    }
  }

  private async setupWebRTC(roomId: string): Promise<void> {
    const webrtcConfig: WebRTCConfig = {
      onTyping: (userId, userName, isTyping) => {
        this.config.onTyping?.(userId, userName, isTyping);
      },
      onPresence: (userId, userName, status) => {
        this.config.onPresence?.(userId, userName, status);
        if (status === 'online') {
          this.config.onParticipantJoin?.(userId);
        } else if (status === 'offline') {
          this.config.onParticipantLeave?.(userId);
        }
      },
      onMessage: async (message: ChatMessage) => {
        // Decrypt message if encrypted and decrypt function is provided
        if (message.encrypted && this.config.decrypt) {
          try {
            const encryptedData = (message as unknown as { encryptedData: EncryptedData }).encryptedData;
            if (encryptedData) {
              const decrypted = await this.config.decrypt(encryptedData);
              message.content = decrypted;
              message.encrypted = false;
            }
          } catch (error) {
            console.error('[RoomManager] Failed to decrypt message:', error);
            return;
          }
        }

        this.config.onParticipantJoin?.(message.senderId);
        this.config.onMessage?.(message);
      },
      onConnectionStateChange: (state: RTCPeerConnectionState) => {
        if (state === 'connected') {
          this.setConnectionState({
            status: 'connected',
            roomId,
            peerId: this.webrtc?.getRoomId() || null,
          });
          this.sendPresence('online');
        } else if (state === 'disconnected' || state === 'failed') {
          this.setConnectionState({
            status: state === 'failed' ? 'error' : 'disconnected',
            roomId: state === 'failed' ? null : roomId,
            peerId: null,
            error: state === 'failed' ? 'Connection failed' : undefined,
          });
        } else if (state === 'connecting') {
          this.setConnectionState({
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

    if (this.isCreator) {
      this.waitForAnswer(roomId);
    }
  }

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

  private setConnectionState(state: ChatConnectionState): void {
    this.connectionState = state;
    this.config.onConnectionStateChange?.(state);
  }

  sendTypingIndicator(isTyping: boolean): void {
    if (!this.webrtc?.isConnected()) return;
    this.webrtc.sendTypingIndicator(isTyping, this.config.userName);
  }

  sendPresence(status: 'online' | 'offline' | 'away'): void {
    if (!this.webrtc?.isConnected()) return;
    this.webrtc.sendPresence(status, this.config.userName);
  }

  async sendMessage(content: string, emoteIds?: string[], customEmojiIds?: string[]): Promise<void> {
    if (!this.webrtc?.isConnected()) {
      throw new Error('Not connected to room');
    }

    if (!this.currentRoom) {
      throw new Error('No active room');
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: this.currentRoom.roomId,
      senderId: this.config.userId,
      senderName: this.config.userName,
      senderDisplayName: this.config.userName,
      timestamp: new Date().toISOString(),
      content,
      encrypted: false,
      emoteIds,
      customEmojiIds,
      type: 'message',
    };

    // Encrypt message if encryption function is provided
    if (this.config.encrypt) {
      try {
        const encrypted = await this.config.encrypt(message.content);
        message.encrypted = true;
        (message as unknown as { encryptedData: EncryptedData }).encryptedData = encrypted;
      } catch (error) {
        console.error('[RoomManager] Failed to encrypt message:', error);
        // Continue without encryption
      }
    }

    this.webrtc.sendMessage(message);
    
    // Also call onMessage so the sender sees their own message
    this.config.onMessage?.(message);
  }

  private startHeartbeat(roomId: string): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.signaling.sendHeartbeat(roomId).catch((error) => {
        console.error('[RoomManager] Heartbeat failed:', error);
      });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoom) {
      this.sendPresence('offline');
      await this.signaling.leaveRoom(this.currentRoom.roomId, this.config.userId);
    }

    this.stopHeartbeat();

    if (this.webrtc) {
      this.webrtc.cleanup();
      this.webrtc = null;
    }

    this.currentRoom = null;
    this.config.onRoomChange?.(null);
    
    this.setConnectionState({
      status: 'disconnected',
      roomId: null,
      peerId: null,
    });
  }

  async getActiveRooms(): Promise<RoomMetadata[]> {
    return this.signaling.getActiveRooms();
  }

  isConnected(): boolean {
    return this.webrtc?.isConnected() || false;
  }

  getConnectionState(): ChatConnectionState {
    return this.connectionState;
  }

  getCurrentRoom(): RoomMetadata | null {
    return this.currentRoom;
  }

  destroy(): void {
    this.leaveRoom().catch(console.error);
  }
}
