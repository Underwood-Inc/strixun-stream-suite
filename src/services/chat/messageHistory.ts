/**
 * Message History Service
 * 
 * Composable, agnostic service for persisting chat messages in IndexedDB with encryption.
 * Handles message storage, retrieval, and cleanup.
 * 
 * @module services/chat/messageHistory
 */

import { encrypt, decrypt, type EncryptedData } from '../../core/services/encryption';
import type { ChatMessage } from '../../types/chat';

export interface MessageHistoryConfig {
  /**
   * Database name
   * @default 'chat_history'
   */
  dbName?: string;
  
  /**
   * Store name for messages
   * @default 'messages'
   */
  storeName?: string;
  
  /**
   * Maximum number of messages to keep per room
   * @default 1000
   */
  maxMessagesPerRoom?: number;
  
  /**
   * Encryption token (JWT token for key derivation)
   * Optional - if not provided, messages are stored unencrypted
   */
  encryptionToken?: string;
}

export interface StoredMessage {
  /**
   * Message ID
   */
  id: string;
  
  /**
   * Room ID
   */
  roomId: string;
  
  /**
   * Encrypted message data (or unencrypted data structure)
   */
  encryptedData: EncryptedData | { encrypted: false; data: string };
  
  /**
   * Message metadata (not encrypted, for indexing)
   */
  metadata: {
    senderId: string;
    senderName: string;
    timestamp: string;
    type?: string;
  };
  
  /**
   * Storage timestamp
   */
  storedAt: string;
}

/**
 * Message History Service
 * 
 * Manages encrypted message persistence in IndexedDB
 */
export class MessageHistoryService {
  private config: MessageHistoryConfig;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config: MessageHistoryConfig) {
    this.config = {
      dbName: 'chat_history',
      storeName: 'messages',
      maxMessagesPerRoom: 1000,
      ...config,
    };
  }

  /**
   * Initialize IndexedDB database
   */
  private async initDatabase(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName!, 1);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.config.storeName!)) {
          const store = db.createObjectStore(this.config.storeName!, { keyPath: 'id' });
          
          // Create indexes for efficient queries
          store.createIndex('roomId', 'roomId', { unique: false });
          store.createIndex('timestamp', 'metadata.timestamp', { unique: false });
          store.createIndex('roomId_timestamp', ['roomId', 'metadata.timestamp'], { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save message to history (encrypted)
   * 
   * @param message - Message to save
   */
  async saveMessage(message: ChatMessage): Promise<void> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Encrypt message content if encryption token is available
      // With HttpOnly cookies, token may not be accessible
      const messageData = JSON.stringify({
        content: message.content,
        emoteIds: message.emoteIds,
        customEmojiIds: message.customEmojiIds,
      });
      
      const encryptedContent = this.config.encryptionToken
        ? await encrypt(messageData, this.config.encryptionToken)
        : null; // Store unencrypted if no token available

      const storedMessage: StoredMessage = {
        id: message.id,
        roomId: message.roomId,
        encryptedData: encryptedContent,
        metadata: {
          senderId: message.senderId,
          senderName: message.senderName,
          timestamp: message.timestamp,
          type: message.type,
        },
        storedAt: new Date().toISOString(),
      };

      const transaction = this.db.transaction([this.config.storeName!], 'readwrite');
      const store = transaction.objectStore(this.config.storeName!);
      await store.put(storedMessage);

      // Cleanup old messages if needed
      await this.cleanupOldMessages(message.roomId);
    } catch (error) {
      console.error('[MessageHistory] Failed to save message:', error);
      throw error;
    }
  }

  /**
   * Load message history for a room
   * 
   * @param roomId - Room ID
   * @param limit - Maximum number of messages to load
   * @returns Decrypted messages
   */
  async loadHistory(roomId: string, limit: number = 100): Promise<ChatMessage[]> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const transaction = this.db.transaction([this.config.storeName!], 'readonly');
      const store = transaction.objectStore(this.config.storeName!);
      const index = store.index('roomId_timestamp');

      // Query messages for this room, sorted by timestamp (descending)
      const range = IDBKeyRange.bound(
        [roomId, ''],
        [roomId, '\uffff'],
        false,
        false
      );

      const request = index.openCursor(range, 'prev'); // Descending order
      const messages: ChatMessage[] = [];
      let count = 0;

      return new Promise((resolve, reject) => {
        request.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          
          if (cursor && count < limit) {
            const stored = cursor.value as StoredMessage;
            
            try {
              // Decrypt message content if encrypted, otherwise use as-is
              let contentData: any;
              if (stored.encryptedData && typeof stored.encryptedData === 'object' && 'encrypted' in stored.encryptedData && !stored.encryptedData.encrypted) {
                // Unencrypted message
                contentData = JSON.parse((stored.encryptedData as any).data);
              } else if (this.config.encryptionToken) {
                // Encrypted message - decrypt it
                const decrypted = await decrypt(stored.encryptedData, this.config.encryptionToken);
                contentData = JSON.parse(decrypted as string);
              } else {
                // No encryption token available - try to parse as unencrypted
                contentData = typeof stored.encryptedData === 'string' 
                  ? JSON.parse(stored.encryptedData)
                  : (stored.encryptedData as any);
              }

              const message: ChatMessage = {
                id: stored.id,
                roomId: stored.roomId,
                senderId: stored.metadata.senderId,
                senderName: stored.metadata.senderName,
                timestamp: stored.metadata.timestamp,
                content: contentData.content,
                encrypted: false, // Already decrypted
                emoteIds: contentData.emoteIds,
                customEmojiIds: contentData.customEmojiIds,
                type: stored.metadata.type as any,
              };

              messages.push(message);
              count++;
              cursor.continue();
            } catch (error) {
              console.error('[MessageHistory] Failed to decrypt message:', error);
              cursor.continue(); // Skip corrupted messages
            }
          } else {
            // Reverse to get chronological order (oldest first)
            resolve(messages.reverse());
          }
        };

        request.onerror = () => {
          reject(new Error('Failed to load message history'));
        };
      });
    } catch (error) {
      console.error('[MessageHistory] Failed to load history:', error);
      throw error;
    }
  }

  /**
   * Clear message history for a room
   * 
   * @param roomId - Room ID
   */
  async clearHistory(roomId: string): Promise<void> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([this.config.storeName!], 'readwrite');
    const store = transaction.objectStore(this.config.storeName!);
    const index = store.index('roomId');

    const range = IDBKeyRange.only(roomId);
    const request = index.openCursor(range);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to clear history'));
      };
    });
  }

  /**
   * Cleanup old messages beyond the limit
   * 
   * @param roomId - Room ID
   */
  private async cleanupOldMessages(roomId: string): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.config.storeName!], 'readwrite');
      const store = transaction.objectStore(this.config.storeName!);
      const index = store.index('roomId_timestamp');

      const range = IDBKeyRange.bound(
        [roomId, ''],
        [roomId, '\uffff'],
        false,
        false
      );

      const request = index.openCursor(range, 'prev');
      let count = 0;
      const messagesToDelete: string[] = [];

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          
          if (cursor) {
            count++;
            if (count > this.config.maxMessagesPerRoom!) {
              messagesToDelete.push(cursor.value.id);
            }
            cursor.continue();
          } else {
            // Delete old messages
            if (messagesToDelete.length > 0) {
              const deleteTransaction = this.db!.transaction([this.config.storeName!], 'readwrite');
              const deleteStore = deleteTransaction.objectStore(this.config.storeName!);
              
              messagesToDelete.forEach(id => {
                deleteStore.delete(id);
              });
            }
            resolve();
          }
        };

        request.onerror = () => {
          reject(new Error('Failed to cleanup messages'));
        };
      });
    } catch (error) {
      console.error('[MessageHistory] Cleanup failed:', error);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Get message count for a room
   * 
   * @param roomId - Room ID
   * @returns Message count
   */
  async getMessageCount(roomId: string): Promise<number> {
    await this.initDatabase();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([this.config.storeName!], 'readonly');
    const store = transaction.objectStore(this.config.storeName!);
    const index = store.index('roomId');

    const range = IDBKeyRange.only(roomId);
    const request = index.count(range);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to count messages'));
      };
    });
  }
}

