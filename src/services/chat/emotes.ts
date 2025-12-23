/**
 * 7TV Emote Service
 * 
 * Handles fetching and caching 7TV emotes
 */

import type { EmoteData } from '../../types/chat';

const SEVENTV_API_BASE = 'https://7tv.io/v3';
const EMOTE_CACHE_KEY = 'seventv_emotes_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface EmoteCache {
  emotes: Map<string, EmoteData>;
  timestamp: number;
}

export class SevenTVEmoteService {
  private cache: EmoteCache | null = null;

  /**
   * Load cache from localStorage
   */
  private loadCache(): EmoteCache | null {
    try {
      const cached = localStorage.getItem(EMOTE_CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - data.timestamp > CACHE_DURATION) {
        localStorage.removeItem(EMOTE_CACHE_KEY);
        return null;
      }

      // Restore Map from array
      const emotes = new Map<string, EmoteData>();
      if (Array.isArray(data.emotes)) {
        data.emotes.forEach(([key, value]: [string, EmoteData]) => {
          emotes.set(key, value);
        });
      }

      return {
        emotes,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error('[7TV] Failed to load cache:', error);
      return null;
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCache(cache: EmoteCache): void {
    try {
      // Convert Map to array for JSON serialization
      const emotesArray = Array.from(cache.emotes.entries());
      localStorage.setItem(
        EMOTE_CACHE_KEY,
        JSON.stringify({
          emotes: emotesArray,
          timestamp: cache.timestamp,
        })
      );
    } catch (error) {
      console.error('[7TV] Failed to save cache:', error);
    }
  }

  /**
   * Get emote by ID
   */
  async getEmote(emoteId: string): Promise<EmoteData | null> {
    // Check cache first
    if (!this.cache) {
      this.cache = this.loadCache();
    }

    if (this.cache?.emotes.has(emoteId)) {
      return this.cache.emotes.get(emoteId)!;
    }

    // Fetch from API
    try {
      const response = await fetch(`${SEVENTV_API_BASE}/emotes/${emoteId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const emote: EmoteData = {
        id: data.id,
        name: data.name,
        url: this.getEmoteUrl(data),
        animated: data.animated || false,
        width: data.width || 28,
        height: data.height || 28,
        provider: '7tv',
      };

      // Update cache
      if (!this.cache) {
        this.cache = {
          emotes: new Map(),
          timestamp: Date.now(),
        };
      }

      this.cache.emotes.set(emoteId, emote);
      this.saveCache(this.cache);

      return emote;
    } catch (error) {
      console.error('[7TV] Failed to fetch emote:', error);
      return null;
    }
  }

  /**
   * Get global emotes
   */
  async getGlobalEmotes(): Promise<EmoteData[]> {
    try {
      const response = await fetch(`${SEVENTV_API_BASE}/emotes/global`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const emotes: EmoteData[] = data.map((emote: any) => ({
        id: emote.id,
        name: emote.name,
        url: this.getEmoteUrl(emote),
        animated: emote.animated || false,
        width: emote.width || 28,
        height: emote.height || 28,
        provider: '7tv',
      }));

      // Update cache
      if (!this.cache) {
        this.cache = {
          emotes: new Map(),
          timestamp: Date.now(),
        };
      }

      emotes.forEach((emote) => {
        this.cache!.emotes.set(emote.id, emote);
      });

      this.saveCache(this.cache!);

      return emotes;
    } catch (error) {
      console.error('[7TV] Failed to fetch global emotes:', error);
      return [];
    }
  }

  /**
   * Get user's emotes
   */
  async getUserEmotes(userId: string): Promise<EmoteData[]> {
    try {
      const response = await fetch(`${SEVENTV_API_BASE}/users/${userId}/emotes`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const emotes: EmoteData[] = (data.emote_set?.emotes || []).map((emote: any) => ({
        id: emote.id,
        name: emote.name,
        url: this.getEmoteUrl(emote.data || emote),
        animated: emote.data?.animated || emote.animated || false,
        width: emote.data?.width || emote.width || 28,
        height: emote.data?.height || emote.height || 28,
        provider: '7tv',
      }));

      // Update cache
      if (!this.cache) {
        this.cache = {
          emotes: new Map(),
          timestamp: Date.now(),
        };
      }

      emotes.forEach((emote) => {
        this.cache!.emotes.set(emote.id, emote);
      });

      this.saveCache(this.cache!);

      return emotes;
    } catch (error) {
      console.error('[7TV] Failed to fetch user emotes:', error);
      return [];
    }
  }

  /**
   * Get emote URL from 7TV data
   */
  private getEmoteUrl(emoteData: any): string {
    // 7TV CDN URL format: https://cdn.7tv.app/emote/{id}/{size}.{format}
    const emoteId = emoteData.id || emoteData.emote_id;
    const animated = emoteData.animated || false;
    const format = animated ? 'gif' : 'webp';
    const size = '2x'; // 2x resolution for better quality

    return `https://cdn.7tv.app/emote/${emoteId}/${size}.${format}`;
  }

  /**
   * Search emotes by name
   */
  async searchEmotes(query: string, limit: number = 20): Promise<EmoteData[]> {
    try {
      const response = await fetch(
        `${SEVENTV_API_BASE}/emotes?query=${encodeURIComponent(query)}&limit=${limit}`
      );
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.items?.map((emote: any) => ({
        id: emote.id,
        name: emote.name,
        url: this.getEmoteUrl(emote),
        animated: emote.animated || false,
        width: emote.width || 28,
        height: emote.height || 28,
        provider: '7tv',
      })) || [];
    } catch (error) {
      console.error('[7TV] Failed to search emotes:', error);
      return [];
    }
  }

  /**
   * Parse message for emote IDs
   */
  parseEmotes(message: string): string[] {
    // 7TV emote format: :emote_name: or custom format
    // This is a simple implementation - can be enhanced
    const emoteRegex = /:([a-zA-Z0-9_]+):/g;
    const matches = message.matchAll(emoteRegex);
    const emoteIds: string[] = [];

    // Note: This would need to match emote names to IDs
    // For now, this is a placeholder
    for (const match of matches) {
      const emoteName = match[1];
      // Would need to lookup emote ID by name
      // For now, just return the pattern
    }

    return emoteIds;
  }
}

// Singleton instance
export const sevenTVEmoteService = new SevenTVEmoteService();

