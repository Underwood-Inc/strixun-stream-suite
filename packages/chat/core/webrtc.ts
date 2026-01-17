/**
 * WebRTC Connection Service
 * 
 * Framework-agnostic WebRTC connection management for P2P chat.
 * Supports P2P protocol messages for history sync and room key exchange.
 */

import type { ChatMessage, WebRTCIceCandidate, P2PProtocolMessage } from './types.js';

export interface WebRTCConfig {
  iceServers?: RTCConfiguration['iceServers'];
  onMessage: (message: ChatMessage) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: Error) => void;
  onTyping?: (userId: string, userName: string, isTyping: boolean) => void;
  onPresence?: (userId: string, userName: string, status: 'online' | 'offline' | 'away') => void;
  /** Handler for P2P protocol messages (sync, room key exchange) */
  onP2PProtocolMessage?: (fromPeerId: string, message: P2PProtocolMessage) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: WebRTCConfig;
  private localUserId: string;
  private roomId: string | null = null;

  constructor(localUserId: string, config: WebRTCConfig) {
    this.localUserId = localUserId;
    this.config = config;
  }

  /**
   * Create peer connection and data channel
   */
  async createConnection(roomId: string): Promise<void> {
    if (this.peerConnection) {
      throw new Error('Connection already exists');
    }

    this.roomId = roomId;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers || DEFAULT_ICE_SERVERS,
    });

    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.config.onConnectionStateChange(state);
      }
    });

    this.peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate && this.roomId) {
        this.handleIceCandidate(event.candidate);
      }
    });

    this.peerConnection.addEventListener('datachannel', (event) => {
      this.setupDataChannel(event.channel);
    });

    this.dataChannel = this.peerConnection.createDataChannel('chat', {
      ordered: true,
    });

    this.setupDataChannel(this.dataChannel);
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.addEventListener('open', () => {
      console.log('[WebRTC] Data channel opened');
    });

    channel.addEventListener('close', () => {
      console.log('[WebRTC] Data channel closed');
      this.cleanup();
    });

    channel.addEventListener('error', () => {
      this.config.onError(new Error('Data channel error'));
    });

    channel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // P2P Protocol messages for sync and key exchange
        if (this.isP2PProtocolMessage(data.type)) {
          if (this.config.onP2PProtocolMessage) {
            this.config.onP2PProtocolMessage(data.senderId || 'unknown', data);
          }
        } else if (data.type === 'typing' || data.type === 'typing_stop') {
          if (this.config.onTyping) {
            this.config.onTyping(data.userId, data.userName, data.type === 'typing');
          }
        } else if (data.type === 'presence') {
          if (this.config.onPresence) {
            this.config.onPresence(data.userId, data.userName, data.status);
          }
        } else {
          const message = data as ChatMessage;
          this.config.onMessage(message);
        }
      } catch (error) {
        console.error('[WebRTC] Failed to parse message:', error);
      }
    });

    this.dataChannel = channel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  async setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.setRemoteDescription(offer);
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  sendMessage(message: ChatMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    this.dataChannel.send(JSON.stringify(message));
  }

  sendTypingIndicator(isTyping: boolean, userName: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    if (!this.roomId) return;

    const event = {
      type: isTyping ? 'typing' : 'typing_stop',
      userId: this.localUserId,
      userName,
      roomId: this.roomId,
      timestamp: new Date().toISOString(),
    };

    this.dataChannel.send(JSON.stringify(event));
  }

  sendPresence(status: 'online' | 'offline' | 'away', userName: string): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    if (!this.roomId) return;

    const event = {
      type: 'presence',
      userId: this.localUserId,
      userName,
      roomId: this.roomId,
      status,
      timestamp: new Date().toISOString(),
    };

    this.dataChannel.send(JSON.stringify(event));
  }

  private handleIceCandidate(candidate: RTCIceCandidate): void {
    if (this.dataChannel?.readyState === 'open' && this.roomId) {
      const iceMessage: WebRTCIceCandidate = {
        type: 'ice-candidate',
        candidate: candidate.toJSON(),
        roomId: this.roomId,
        fromUserId: this.localUserId,
      };
      this.dataChannel.send(JSON.stringify(iceMessage));
    }
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  cleanup(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.roomId = null;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  /**
   * Check if message type is a P2P protocol message
   */
  private isP2PProtocolMessage(type: string): boolean {
    const protocolTypes = [
      'sync_request',
      'sync_response',
      'room_key_request',
      'room_key_response',
      'chat_message',
    ];
    return protocolTypes.includes(type);
  }

  /**
   * Send a P2P protocol message
   */
  sendP2PProtocolMessage(message: P2PProtocolMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    // Add sender ID to message for routing
    const messageWithSender = {
      ...message,
      senderId: this.localUserId,
    };

    this.dataChannel.send(JSON.stringify(messageWithSender));
  }

  /**
   * Check if the data channel is ready for sending
   */
  isDataChannelReady(): boolean {
    return this.dataChannel?.readyState === 'open';
  }
}
