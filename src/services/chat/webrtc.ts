/**
 * WebRTC Connection Service
 * 
 * Manages peer-to-peer WebRTC connections for chat
 */

import type { ChatMessage, WebRTCOffer, WebRTCAnswer, WebRTCIceCandidate } from '../../types/chat';

export interface WebRTCConfig {
  iceServers: RTCConfiguration['iceServers'];
  onMessage: (message: ChatMessage) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: Error) => void;
}

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

    // Create peer connection with STUN servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Handle connection state changes
    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.config.onConnectionStateChange(state);
      }
    });

    // Handle ICE candidates
    this.peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate && this.roomId) {
        // ICE candidates are sent directly via data channel once established
        // For initial setup, they're handled by signaling server
        this.handleIceCandidate(event.candidate);
      }
    });

    // Handle incoming data channel
    this.peerConnection.addEventListener('datachannel', (event) => {
      this.setupDataChannel(event.channel);
    });

    // Create data channel for outgoing connection
    this.dataChannel = this.peerConnection.createDataChannel('chat', {
      ordered: true,
    });

    this.setupDataChannel(this.dataChannel);
  }

  /**
   * Setup data channel event handlers
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    channel.addEventListener('open', () => {
      console.log('[WebRTC] Data channel opened');
    });

    channel.addEventListener('close', () => {
      console.log('[WebRTC] Data channel closed');
      this.cleanup();
    });

    channel.addEventListener('error', (event) => {
      console.error('[WebRTC] Data channel error:', event);
      this.config.onError(new Error('Data channel error'));
    });

    channel.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as ChatMessage;
        this.config.onMessage(message);
      } catch (error) {
        console.error('[WebRTC] Failed to parse message:', error);
      }
    });

    this.dataChannel = channel;
  }

  /**
   * Create offer for peer connection
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    return offer;
  }

  /**
   * Set remote description from offer
   */
  async setRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.setRemoteDescription(offer);
  }

  /**
   * Create answer for received offer
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  /**
   * Set remote description from answer
   */
  async setRemoteAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send message via data channel
   */
  sendMessage(message: ChatMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    this.dataChannel.send(JSON.stringify(message));
  }

  /**
   * Handle ICE candidate
   */
  private handleIceCandidate(candidate: RTCIceCandidate): void {
    // ICE candidates are sent via signaling server during initial setup
    // Once data channel is open, they can be sent directly
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

  /**
   * Get connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }

  /**
   * Cleanup connection
   */
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

  /**
   * Get room ID
   */
  getRoomId(): string | null {
    return this.roomId;
  }
}

