/**
 * Game API Service
 * 
 * Client-side API service for idle game endpoints
 * Uses existing auth system and encryption utilities
 */

import { decryptWithJWT } from '@strixun/api-framework';

// Auth functions must be provided by the consuming app
// This library accepts them as constructor parameters to avoid app-specific dependencies
type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;
type GetToken = () => string | null | Promise<string | null>;
import type {
    CharacterAppearance,
    CraftingResult,
    CraftingSession,
    DungeonInstance,
    DungeonRun,
    Equipment,
    GameItem,
    GeneratedItem,
    IdleActivity,
    IdleProgressResult,
    Inventory,
    LootBoxOpenResult,
    LootBoxStatus,
    LootTable
} from '../types/index.js';

// Character type from inventory (since GameCharacter might not exist yet)
interface GameCharacter {
  id: string;
  customerId: string;
  name: string;
  level: number;
  experience: number;
  appearance: CharacterAppearance;
  [key: string]: unknown;
}

/**
 * Get Game API URL
 * Priority: manual override > auto-injected > hardcoded fallback
 */
function getGameApiUrl(): string {
  // Priority 1: Manual override from storage (if available)
  if (typeof window !== 'undefined' && (window as any).localStorage) {
    const manualOverride = localStorage.getItem('game_api_server');
    if (manualOverride && manualOverride.trim() !== '') {
      return manualOverride.trim();
    }
  }

  // Priority 2: Auto-injected during deployment
  if (typeof window !== 'undefined' && (window as any).STRIXUN_CONFIG?.GAME_API_URL) {
    const injected = (window as any).STRIXUN_CONFIG.GAME_API_URL;
    if (injected && !injected.startsWith('%%')) {
      return injected;
    }
  }

  // Priority 3: Hardcoded fallback - use custom domain (game.idling.app)
  const CUSTOM_DOMAIN_URL = 'https://game.idling.app';
  const WORKERS_DEV_URL = 'https://strixun-game-api.strixuns-script-suite.workers.dev';
  
  // Use custom domain as primary (game.idling.app)
  const HARDCODED_GAME_API_URL = CUSTOM_DOMAIN_URL;
  
  if (HARDCODED_GAME_API_URL && !HARDCODED_GAME_API_URL.includes('UPDATE-ME')) {
    return HARDCODED_GAME_API_URL;
  }

  // Priority 4: Fallback to workers.dev URL
  return WORKERS_DEV_URL;
}

/**
 * Game API Service
 * Handles all game API calls with automatic decryption
 */
export class GameApiService {
  private baseUrl: string;
  private authenticatedFetch: AuthFetch;
  private getAuthToken: GetToken;

  constructor(authenticatedFetch: AuthFetch, getAuthToken: GetToken) {
    this.baseUrl = getGameApiUrl();
    this.authenticatedFetch = authenticatedFetch;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Make authenticated request with automatic decryption
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await this.authenticatedFetch(`${this.baseUrl}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { detail?: string; error?: string }).detail || (error as { error?: string }).error || 'Request failed');
    }

    // Check if response is encrypted
    const isEncrypted = response.headers.get('X-Encrypted') === 'true';
    const data = await response.json();

    if (isEncrypted) {
      const token = await Promise.resolve(this.getAuthToken());
      if (!token) {
        throw new Error('No auth token available for decryption');
      }
      // Use existing decryption utility
      return await decryptWithJWT(data, token) as T;
    }

    return data as T;
  }

  // ============ Save State ============

  async saveGameState(characterId: string, saveData: unknown, version?: string): Promise<{ success: boolean; savedAt: string }> {
    return this.request('/game/save-state', {
      method: 'POST',
      body: JSON.stringify({ characterId, saveData, version }),
    });
  }

  async loadGameState(characterId: string): Promise<{ success: boolean; saveState: unknown }> {
    return this.request(`/game/save-state?characterId=${encodeURIComponent(characterId)}`);
  }

  // ============ Daily Loot Boxes ============

  async getLootBoxStatus(): Promise<LootBoxStatus> {
    return this.request('/game/loot-box/status');
  }

  async claimLootBox(): Promise<LootBoxOpenResult> {
    return this.request('/game/loot-box/claim', {
      method: 'POST',
    });
  }

  // ============ Idle Mechanics ============

  async getIdleProgress(): Promise<IdleProgressResult> {
    return this.request('/game/idle/progress');
  }

  async claimIdleRewards(): Promise<{ success: boolean; rewards: unknown }> {
    return this.request('/game/idle/claim', {
      method: 'POST',
    });
  }

  async startIdleActivity(activityId: string, slotIndex: number): Promise<{ success: boolean; activity: IdleActivity }> {
    return this.request('/game/idle/activity/start', {
      method: 'POST',
      body: JSON.stringify({ activityId, slotIndex }),
    });
  }

  async stopIdleActivity(slotIndex: number): Promise<{ success: boolean }> {
    return this.request('/game/idle/activity/stop', {
      method: 'POST',
      body: JSON.stringify({ slotIndex }),
    });
  }

  // ============ Crafting ============

  async startCrafting(characterId: string, recipeId: string, quantity?: number, specialMaterials?: string[]): Promise<{ success: boolean; session: CraftingSession }> {
    return this.request('/game/crafting/start', {
      method: 'POST',
      body: JSON.stringify({ characterId, recipeId, quantity, specialMaterials }),
    });
  }

  async collectCrafting(sessionId: string): Promise<{ success: boolean; result: CraftingResult }> {
    return this.request('/game/crafting/collect', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async getCraftingSessions(characterId: string): Promise<{ success: boolean; sessions: CraftingSession[] }> {
    return this.request(`/game/crafting/sessions?characterId=${encodeURIComponent(characterId)}`);
  }

  // ============ Dungeons ============

  async startDungeon(characterId: string, dungeonId: string, difficulty?: string, instanceType?: string): Promise<{ success: boolean; instance: DungeonInstance }> {
    return this.request('/game/dungeons/start', {
      method: 'POST',
      body: JSON.stringify({ characterId, dungeonId, difficulty, instanceType }),
    });
  }

  async completeRoom(instanceId: string, roomId: string, result?: string): Promise<{ success: boolean; instance: DungeonInstance }> {
    return this.request('/game/dungeons/complete-room', {
      method: 'POST',
      body: JSON.stringify({ instanceId, roomId, result }),
    });
  }

  async completeDungeon(instanceId: string): Promise<{ success: boolean; run: DungeonRun }> {
    return this.request('/game/dungeons/complete', {
      method: 'POST',
      body: JSON.stringify({ instanceId }),
    });
  }

  async getDungeonInstances(characterId: string): Promise<{ success: boolean; instances: DungeonInstance[] }> {
    return this.request(`/game/dungeons/instances?characterId=${encodeURIComponent(characterId)}`);
  }

  // ============ Inventory ============

  async getInventory(characterId: string): Promise<{ success: boolean; inventory: Inventory; equipment: Equipment }> {
    return this.request(`/game/inventory?characterId=${encodeURIComponent(characterId)}`);
  }

  async addItem(characterId: string, item: GameItem): Promise<{ success: boolean; inventory: Inventory }> {
    return this.request('/game/inventory/item', {
      method: 'POST',
      body: JSON.stringify({ characterId, item }),
    });
  }

  async removeItem(characterId: string, itemId: string): Promise<{ success: boolean; inventory: Inventory }> {
    return this.request(`/game/inventory/item?characterId=${encodeURIComponent(characterId)}&itemId=${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    });
  }

  async equipItem(characterId: string, itemId: string, slot: string): Promise<{ success: boolean; equipment: Equipment }> {
    return this.request('/game/inventory/equip', {
      method: 'POST',
      body: JSON.stringify({ characterId, itemId, slot }),
    });
  }

  // ============ Character ============

  async getCharacter(characterId: string): Promise<{ success: boolean; character: GameCharacter }> {
    return this.request(`/game/character?characterId=${encodeURIComponent(characterId)}`);
  }

  async createCharacter(name: string, appearance: CharacterAppearance): Promise<{ success: boolean; character: GameCharacter }> {
    return this.request('/game/character', {
      method: 'POST',
      body: JSON.stringify({ name, appearance }),
    });
  }

  async updateAppearance(characterId: string, appearance: CharacterAppearance, customTextures?: Record<string, string>): Promise<{ success: boolean; character: GameCharacter }> {
    return this.request('/game/character/appearance', {
      method: 'PUT',
      body: JSON.stringify({ characterId, appearance, customTextures }),
    });
  }

  // ============ Loot Generation ============

  async generateLoot(lootTableId: string, options?: { itemLevel?: number; rarity?: string }): Promise<{ success: boolean; item: GeneratedItem }> {
    return this.request('/game/loot/generate', {
      method: 'POST',
      body: JSON.stringify({ lootTableId, options }),
    });
  }

  async getLootTables(): Promise<{ success: boolean; tables: LootTable[] }> {
    return this.request('/game/loot/tables');
  }
}

// Note: gameApi instance must be created by the consuming app with auth functions
// Example:
// import { GameApiService } from '@strixun/idle-game-overlay';
// import { authenticatedFetch, getAuthToken } from './stores/auth';
// export const gameApi = new GameApiService(authenticatedFetch, getAuthToken);

