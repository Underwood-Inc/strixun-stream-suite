/**
 * Custom Emoji Service
 * 
 * Handles custom emojis exclusive to configured domains
 */

import type { CustomEmoji, EmoteData } from '../../types/chat';
import { authenticatedFetch } from '../../stores/auth';

export interface CustomEmojiConfig {
  baseUrl: string;
  token: string;
  domain: string;
}

export class CustomEmojiService {
  private config: CustomEmojiConfig;
  private cache: Map<string, CustomEmoji> = new Map();

  constructor(config: CustomEmojiConfig) {
    this.config = config;
  }

  /**
   * Get all custom emojis for current domain
   */
  async getCustomEmojis(): Promise<CustomEmoji[]> {
    try {
      const response = await authenticatedFetch(
        `${this.config.baseUrl}/emoji/list?domain=${encodeURIComponent(this.config.domain)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch custom emojis: ${response.statusText}`);
      }

      const data = await response.json();
      const emojis: CustomEmoji[] = data.emojis || [];

      // Update cache
      emojis.forEach((emoji) => {
        this.cache.set(emoji.id, emoji);
      });

      return emojis;
    } catch (error) {
      console.error('[CustomEmoji] Failed to fetch emojis:', error);
      return [];
    }
  }

  /**
   * Get custom emoji by ID
   */
  async getCustomEmoji(emojiId: string): Promise<CustomEmoji | null> {
    // Check cache first
    if (this.cache.has(emojiId)) {
      return this.cache.get(emojiId)!;
    }

    try {
      const response = await authenticatedFetch(`${this.config.baseUrl}/emoji/${emojiId}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const emoji: CustomEmoji = data.emoji;

      // Update cache
      this.cache.set(emojiId, emoji);

      return emoji;
    } catch (error) {
      console.error('[CustomEmoji] Failed to fetch emoji:', error);
      return null;
    }
  }

  /**
   * Convert custom emoji to EmoteData format
   */
  customEmojiToEmoteData(emoji: CustomEmoji): EmoteData {
    return {
      id: emoji.id,
      name: emoji.name,
      url: emoji.url,
      animated: emoji.url.endsWith('.gif'),
      width: 28,
      height: 28,
      provider: 'custom',
    };
  }

  /**
   * Upload new custom emoji
   */
  async uploadEmoji(name: string, file: File): Promise<CustomEmoji> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('domain', this.config.domain);

    const response = await authenticatedFetch(`${this.config.baseUrl}/emoji/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload emoji: ${response.statusText}`);
    }

    const data = await response.json();
    const emoji: CustomEmoji = data.emoji;

    // Update cache
    this.cache.set(emoji.id, emoji);

    return emoji;
  }

  /**
   * Parse message for custom emoji IDs
   */
  parseCustomEmojis(message: string, emojis: CustomEmoji[]): string[] {
    const emojiIds: string[] = [];
    const emojiMap = new Map(emojis.map((e) => [e.name, e.id]));

    // Simple pattern matching for :emoji_name:
    const emojiRegex = /:([a-zA-Z0-9_]+):/g;
    const matches = message.matchAll(emojiRegex);

    for (const match of matches) {
      const emojiName = match[1];
      const emojiId = emojiMap.get(emojiName);
      if (emojiId && !emojiIds.includes(emojiId)) {
        emojiIds.push(emojiId);
      }
    }

    return emojiIds;
  }
}

