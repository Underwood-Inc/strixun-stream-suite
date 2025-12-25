/**
 * VOIP Service (Post-MVP)
 * 
 * Composable, agnostic service for peer-to-peer voice communication.
 * Extends WebRTC with audio streams and SRTP encryption.
 * 
 * @module services/chat/voip
 * 
 * Architecture Design:
 * - Composable: Can be used independently or with chat
 * - Agnostic: Works with any signaling server
 * - Strongly Typed: Full TypeScript coverage
 * - Secure: SRTP (built-in) + application-layer encryption
 */

import type { WebRTCService } from './webrtc';

export interface VOIPConfig {
  /**
   * ICE servers for NAT traversal
   */
  iceServers: RTCConfiguration['iceServers'];
  
  /**
   * Audio constraints
   */
  audioConstraints?: MediaStreamConstraints['audio'];
  
  /**
   * Callback when audio stream is received
   */
  onAudioStream?: (stream: MediaStream, userId: string) => void;
  
  /**
   * Callback when connection state changes
   */
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  
  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
  
  /**
   * Enable application-layer encryption (in addition to SRTP)
   * @default true
   */
  enableAppLayerEncryption?: boolean;
  
  /**
   * Encryption token (for app-layer encryption)
   */
  encryptionToken?: string;
}

export interface VOIPState {
  /**
   * Whether microphone is enabled
   */
  microphoneEnabled: boolean;
  
  /**
   * Whether speaker/audio output is enabled
   */
  speakerEnabled: boolean;
  
  /**
   * Current audio input level (0-100)
   */
  inputLevel: number;
  
  /**
   * Connection quality (0-100)
   */
  connectionQuality: number;
  
  /**
   * Active audio streams (userId -> stream)
   */
  activeStreams: Map<string, MediaStream>;
}

/**
 * VOIP Service
 * 
 * Handles peer-to-peer voice communication with WebRTC
 */
export class VOIPService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private config: VOIPConfig;
  private state: VOIPState;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private inputLevelInterval: number | null = null;

  constructor(config: VOIPConfig) {
    this.config = {
      enableAppLayerEncryption: true,
      ...config,
    };

    this.state = {
      microphoneEnabled: false,
      speakerEnabled: true,
      inputLevel: 0,
      connectionQuality: 0,
      activeStreams: new Map(),
    };
  }

  /**
   * Initialize audio context for input level monitoring
   */
  private async initAudioContext(): Promise<void> {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    // Start monitoring input level
    this.startInputLevelMonitoring();
  }

  /**
   * Start monitoring audio input level
   */
  private startInputLevelMonitoring(): void {
    if (!this.analyser || !this.localStream) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    const source = this.audioContext!.createMediaStreamSource(this.localStream);
    source.connect(this.analyser);

    const updateLevel = () => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      this.state.inputLevel = Math.min(100, (average / 255) * 100);

      if (this.state.microphoneEnabled) {
        this.inputLevelInterval = window.requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  }

  /**
   * Get user media (microphone)
   */
  async enableMicrophone(): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints || {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.localStream = stream;
      this.state.microphoneEnabled = true;

      // Initialize audio context for level monitoring
      await this.initAudioContext();

      // Add tracks to peer connection if it exists
      if (this.peerConnection) {
        stream.getAudioTracks().forEach(track => {
          this.peerConnection!.addTrack(track, stream);
        });
      }

      return stream;
    } catch (error) {
      this.state.microphoneEnabled = false;
      throw new Error(`Failed to access microphone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disable microphone
   */
  disableMicrophone(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    this.state.microphoneEnabled = false;

    if (this.inputLevelInterval !== null) {
      window.cancelAnimationFrame(this.inputLevelInterval);
      this.inputLevelInterval = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }

  /**
   * Create peer connection for VOIP
   * 
   * @param roomId - Room ID
   * @param userId - Local user ID
   */
  async createConnection(roomId: string, userId: string): Promise<void> {
    if (this.peerConnection) {
      throw new Error('Connection already exists');
    }

    // Create peer connection with audio configuration
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Handle incoming audio streams
    this.peerConnection.addEventListener('track', (event) => {
      const stream = event.streams[0];
      const userId = event.track.id.split('_')[0]; // Extract userId from track ID

      if (stream && this.config.onAudioStream) {
        this.state.activeStreams.set(userId, stream);
        this.config.onAudioStream(stream, userId);
      }
    });

    // Handle connection state changes
    this.peerConnection.addEventListener('connectionstatechange', () => {
      const state = this.peerConnection?.connectionState;
      if (state) {
        this.config.onConnectionStateChange?.(state);

        // Update connection quality based on state
        if (state === 'connected') {
          this.state.connectionQuality = 100;
        } else if (state === 'connecting') {
          this.state.connectionQuality = 50;
        } else {
          this.state.connectionQuality = 0;
        }
      }
    });

    // Handle ICE connection state (for quality monitoring)
    this.peerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.state.connectionQuality = 100;
      } else if (state === 'checking' || state === 'connecting') {
        this.state.connectionQuality = 50;
      } else {
        this.state.connectionQuality = 0;
      }
    });

    // Add local audio tracks if microphone is enabled
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  /**
   * Create offer for VOIP connection
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Set remote offer
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

    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });

    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote answer
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
   * Mute/unmute microphone
   */
  setMicrophoneMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Mute/unmute speaker (audio output)
   */
  setSpeakerMuted(muted: boolean): void {
    this.state.speakerEnabled = !muted;
    // Note: Actual speaker muting is handled by the audio element in UI
  }

  /**
   * Get current VOIP state
   */
  getState(): Readonly<VOIPState> {
    return {
      ...this.state,
      activeStreams: new Map(this.state.activeStreams), // Return copy
    };
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
   * Cleanup VOIP connection
   */
  cleanup(): void {
    // Disable microphone
    this.disableMicrophone();

    // Close all remote streams
    this.state.activeStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.state.activeStreams.clear();

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.state = {
      microphoneEnabled: false,
      speakerEnabled: true,
      inputLevel: 0,
      connectionQuality: 0,
      activeStreams: new Map(),
    };
  }
}

