/**
 * Secure Room Manager
 * 
 * Enhanced room management with P2P blockchain-style message persistence.
 * Uses @strixun/p2p-storage for message storage and integrity verification.
 */

import type { 
  ChatMessage, 
  RoomMetadata, 
  ChatConnectionState,
  AuthenticatedFetchFn,
  EncryptedData,
  P2PProtocolMessage,
} from './types.js';
import { SignalingService } from './signaling.js';
import { WebRTCService, type WebRTCConfig } from './webrtc.js';
import { 
  BlockchainManager, 
  createIndexedDBAdapter,
  PeerTracker,
  SyncManager,
  createSyncRequest,
  createSyncResponse,
  verifySyncResponse,
  type StorageAdapter,
  type Block,
  type IntegrityInfo,
} from '@strixun/p2p-storage';

// ============ Types ============

export interface SecureRoomManagerConfig {
  signalingBaseUrl: string;
  userId: string;
  userName: string;
  /** Authenticated fetch function (optional - uses cookies by default) */
  authenticatedFetch?: AuthenticatedFetchFn;
  /** Encryption functions (optional) */
  encrypt?: (content: string) => Promise<EncryptedData>;
  decrypt?: (data: EncryptedData) => Promise<string>;
  /** Custom storage adapter (defaults to IndexedDB) */
  storageAdapter?: StorageAdapter;
  /** Signing key for message integrity (defaults to derived from userId) */
  signingKey?: string;
  /** Callbacks */
  onMessage?: (message: ChatMessage) => void;
  onConnectionStateChange?: (state: ChatConnectionState) => void;
  onRoomChange?: (room: RoomMetadata | null) => void;
  onParticipantJoin?: (userId: string) => void;
  onParticipantLeave?: (userId: string) => void;
  onTyping?: (userId: string, userName: string, isTyping: boolean) => void;
  onPresence?: (userId: string, userName: string, status: 'online' | 'offline' | 'away') => void;
  onError?: (error: Error) => void;
  onIntegrityChange?: (info: IntegrityInfo) => void;
  onPeerCountChange?: (count: number) => void;
  /** Callback for history loaded from storage */
  onHistoryLoaded?: (messages: ChatMessage[]) => void;
}

/** Stored message block data */
interface MessageBlockData {
  message: ChatMessage;
  encryptedContent?: EncryptedData;
}

// ============ Secure Room Manager ============

export class SecureRoomManager {
  private webrtc: WebRTCService | null = null;
  private signaling: SignalingService;
  private config: SecureRoomManagerConfig;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private integrityInterval: ReturnType<typeof setInterval> | null = null;
  private isCreator: boolean = false;
  private currentRoom: RoomMetadata | null = null;
  private connectionState: ChatConnectionState = {
    status: 'disconnected',
    roomId: null,
    peerId: null,
  };
  
  // P2P Storage
  private blockchain: BlockchainManager<MessageBlockData> | null = null;
  private storageAdapter: StorageAdapter;
  private peerTracker: PeerTracker;
  private syncManager: SyncManager;
  private signingKey: string;

  constructor(config: SecureRoomManagerConfig) {
    this.config = config;
    this.signaling = new SignalingService({
      baseUrl: config.signalingBaseUrl,
      authenticatedFetch: config.authenticatedFetch,
    });
    
    // Initialize storage adapter
    this.storageAdapter = config.storageAdapter || createIndexedDBAdapter();
    this.peerTracker = new PeerTracker();
    this.syncManager = new SyncManager();
    this.signingKey = config.signingKey || `chat-${config.userId}`;
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

      // Initialize blockchain storage for this room
      await this.initializeStorage(room.roomId);

      await this.setupWebRTC(room.roomId);
      const offer = await this.webrtc!.createOffer();
      await this.signaling.sendOffer(room.roomId, offer, this.config.userId);
      this.startHeartbeat(room.roomId);
      this.startIntegrityMonitoring();

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

      // Initialize blockchain storage for this room
      await this.initializeStorage(room.roomId);
      
      // Load existing history from local storage
      await this.loadLocalHistory();

      await this.setupWebRTC(room.roomId);
      const offer = await this.signaling.getOffer(room.roomId, 30000);

      if (!offer) {
        throw new Error('Failed to receive offer (timeout)');
      }

      await this.webrtc!.setRemoteOffer(offer);
      const answer = await this.webrtc!.createAnswer();
      await this.signaling.sendAnswer(room.roomId, answer, this.config.userId);
      this.startHeartbeat(room.roomId);
      this.startIntegrityMonitoring();

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

  private async initializeStorage(roomId: string): Promise<void> {
    this.blockchain = new BlockchainManager<MessageBlockData>({
      chainId: roomId,
      signingKey: this.signingKey,
      peerId: this.config.userId,
      adapter: this.storageAdapter,
    });
    
    await this.blockchain.initialize();
  }

  private async loadLocalHistory(): Promise<void> {
    if (!this.blockchain) return;
    
    try {
      const blocks = await this.blockchain.getAllBlocks();
      const messages = blocks.map(block => block.data.message);
      
      if (messages.length > 0) {
        this.config.onHistoryLoaded?.(messages);
      }
    } catch (error) {
      console.error('[SecureRoomManager] Failed to load history:', error);
    }
  }

  private async setupWebRTC(roomId: string): Promise<void> {
    const webrtcConfig: WebRTCConfig = {
      onTyping: (userId, userName, isTyping) => {
        this.config.onTyping?.(userId, userName, isTyping);
      },
      onPresence: (userId, userName, status) => {
        this.config.onPresence?.(userId, userName, status);
        
        // Track peers
        if (status === 'online') {
          this.peerTracker.updatePeer({
            peerId: userId,
            displayName: userName,
            blockRange: { start: 0, end: 0 },
            completeChunks: [],
            lastSeen: Date.now(),
            online: true,
          });
          this.config.onParticipantJoin?.(userId);
          this.config.onPeerCountChange?.(this.peerTracker.getPeerCount());
          
          // Request sync when new peer joins
          this.requestSync(userId);
        } else if (status === 'offline') {
          this.peerTracker.markOffline(userId);
          this.config.onParticipantLeave?.(userId);
          this.config.onPeerCountChange?.(this.peerTracker.getPeerCount());
        }
      },
      onMessage: async (message: ChatMessage) => {
        await this.handleIncomingMessage(message);
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
      onP2PProtocolMessage: async (fromPeerId, message) => {
        await this.handleP2PProtocolMessage(fromPeerId, message);
      },
    };

    this.webrtc = new WebRTCService(this.config.userId, webrtcConfig);
    await this.webrtc.createConnection(roomId);

    if (this.isCreator) {
      this.waitForAnswer(roomId);
    }
  }

  private async handleIncomingMessage(message: ChatMessage): Promise<void> {
    // Decrypt message if encrypted
    if (message.encrypted && this.config.decrypt) {
      try {
        const encryptedData = (message as unknown as { encryptedData: EncryptedData }).encryptedData;
        if (encryptedData) {
          const decrypted = await this.config.decrypt(encryptedData);
          message.content = decrypted;
          message.encrypted = false;
        }
      } catch (error) {
        console.error('[SecureRoomManager] Failed to decrypt message:', error);
        return;
      }
    }

    // Store in blockchain
    if (this.blockchain) {
      try {
        await this.blockchain.addBlock({
          message,
          encryptedContent: (message as unknown as { encryptedData: EncryptedData }).encryptedData,
        });
      } catch (error) {
        console.error('[SecureRoomManager] Failed to store message:', error);
      }
    }

    this.config.onParticipantJoin?.(message.senderId);
    this.config.onMessage?.(message);
  }

  private async handleP2PProtocolMessage(fromPeerId: string, message: P2PProtocolMessage): Promise<void> {
    if (!this.blockchain || !this.currentRoom) return;
    
    switch (message.type) {
      case 'sync_request': {
        // Respond with our history
        const blocks = await this.blockchain.getBlocksAfter(
          (message as { lastSyncVersion: number }).lastSyncVersion,
          50 // Batch size
        );
        
        const response = await createSyncResponse(
          this.currentRoom.roomId,
          this.config.userId,
          blocks,
          blocks.length === 50 // hasMore if we hit the limit
        );
        
        this.webrtc?.sendP2PProtocolMessage(response as unknown as P2PProtocolMessage);
        break;
      }
      
      case 'sync_response': {
        // Import received blocks
        const syncResponse = message as unknown as {
          blocks: Block<MessageBlockData>[];
          batchHash: string;
          hasMore: boolean;
        };
        
        // Verify integrity
        const isValid = await verifySyncResponse(syncResponse as unknown as Parameters<typeof verifySyncResponse>[0]);
        if (!isValid) {
          console.warn('[SecureRoomManager] Invalid sync response - hash mismatch');
          return;
        }
        
        // Import blocks
        const result = await this.blockchain.importBlocks(syncResponse.blocks);
        console.log(`[SecureRoomManager] Synced ${result.imported} blocks from ${fromPeerId}`);
        
        // Notify about new messages
        for (const block of syncResponse.blocks) {
          this.config.onMessage?.(block.data.message);
        }
        
        // Continue sync if there's more
        if (syncResponse.hasMore) {
          this.requestSync(fromPeerId);
        }
        
        this.syncManager.completeSync();
        break;
      }
      
      default:
        // Other protocol messages handled by WebRTC service
        break;
    }
  }

  private async requestSync(peerId: string): Promise<void> {
    if (!this.blockchain || !this.currentRoom || !this.syncManager.canSync()) return;
    
    try {
      const state = await this.blockchain.getChainState();
      const request = createSyncRequest(
        this.currentRoom.roomId,
        this.config.userId,
        state.latestBlock,
        state.lastSync
      );
      
      this.syncManager.startSync(peerId);
      this.webrtc?.sendP2PProtocolMessage(request as unknown as P2PProtocolMessage);
    } catch (error) {
      console.error('[SecureRoomManager] Sync request failed:', error);
      this.syncManager.failSync((error as Error).message);
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
      console.error('[SecureRoomManager] Failed to receive answer:', error);
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

    let encryptedData: EncryptedData | undefined;

    // Encrypt message if encryption function is provided
    if (this.config.encrypt) {
      try {
        encryptedData = await this.config.encrypt(message.content);
        message.encrypted = true;
        (message as unknown as { encryptedData: EncryptedData }).encryptedData = encryptedData;
      } catch (error) {
        console.error('[SecureRoomManager] Failed to encrypt message:', error);
        // Continue without encryption
      }
    }

    // Store in blockchain
    if (this.blockchain) {
      try {
        await this.blockchain.addBlock({
          message,
          encryptedContent: encryptedData,
        });
      } catch (error) {
        console.error('[SecureRoomManager] Failed to store sent message:', error);
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
        console.error('[SecureRoomManager] Heartbeat failed:', error);
      });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startIntegrityMonitoring(): void {
    this.stopIntegrityMonitoring();
    
    // Update integrity info every 10 seconds
    this.integrityInterval = setInterval(async () => {
      if (this.blockchain) {
        try {
          const info = await this.blockchain.getIntegrityInfo(this.peerTracker.getPeerCount());
          this.config.onIntegrityChange?.(info);
        } catch (error) {
          console.error('[SecureRoomManager] Integrity check failed:', error);
        }
      }
    }, 10000);
  }

  private stopIntegrityMonitoring(): void {
    if (this.integrityInterval !== null) {
      clearInterval(this.integrityInterval);
      this.integrityInterval = null;
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoom) {
      this.sendPresence('offline');
      await this.signaling.leaveRoom(this.currentRoom.roomId, this.config.userId);
    }

    this.stopHeartbeat();
    this.stopIntegrityMonitoring();

    if (this.webrtc) {
      this.webrtc.cleanup();
      this.webrtc = null;
    }

    // Keep blockchain data for persistence
    // Don't destroy - just disconnect
    this.blockchain = null;

    this.currentRoom = null;
    this.peerTracker = new PeerTracker(); // Reset
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

  /**
   * Get current integrity information
   */
  async getIntegrityInfo(): Promise<IntegrityInfo | null> {
    if (!this.blockchain) return null;
    return this.blockchain.getIntegrityInfo(this.peerTracker.getPeerCount());
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.peerTracker.getPeerCount();
  }

  /**
   * Get all stored messages
   */
  async getStoredMessages(): Promise<ChatMessage[]> {
    if (!this.blockchain) return [];
    const blocks = await this.blockchain.getAllBlocks();
    return blocks.map(block => block.data.message);
  }

  /**
   * Force sync with all peers
   */
  async forceSync(): Promise<void> {
    const peers = this.peerTracker.getOnlinePeers();
    for (const peer of peers) {
      await this.requestSync(peer.peerId);
    }
  }

  destroy(): void {
    this.leaveRoom().catch(console.error);
  }
}
