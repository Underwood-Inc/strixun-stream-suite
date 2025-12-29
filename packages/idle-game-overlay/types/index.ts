/**
 * Idle Game Overlay Types
 * 
 * Central export for all game-related types
 */

// Re-export all types from individual modules
export * from './character-customization.js';
export * from './crafting.js';
export * from './dungeons.js';
export * from './idle.js';
export * from './inventory.js';
export * from './loot-boxes.js';
export * from './loot.js';

// Additional API response types
export interface LootBoxStatus {
  available: boolean;
  nextAvailableAt: string;
  streak: {
    current: number;
    longest: number;
    bonus: number;
  };
}

export interface LootBoxOpenResult {
  success: boolean;
  rewards: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: Array<{
      itemTemplateId: string;
      quantity: number;
      rarity: string;
    }>;
  };
  streak: {
    current: number;
    longest: number;
    bonus: number;
  };
  nextAvailableAt: string;
}

export interface IdleProgressResult {
  success: boolean;
  offlineHours: number;
  cappedHours: number;
  lastActiveAt?: string;
  activeActivities: unknown[];
  rewards: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
  };
}

export interface CraftingSession {
  id: string;
  characterId: string;
  recipeId: string;
  quantity: number;
  specialMaterials: string[];
  startedAt: string;
  completesAt: string;
  status: string;
  progressPercent: number;
}

export interface CraftingResult {
  item: unknown;
  quality: number;
  modifiers: unknown[];
}

export interface DungeonInstance {
  id: string;
  dungeonId: string;
  characterId: string;
  difficulty: string;
  instanceType: string;
  currentFloor: number;
  currentRoom: number;
  completedRooms: string[];
  status: string;
  startedAt: string;
  collectedRewards: {
    experience: number;
    gold: number;
    items: unknown[];
  };
}

export interface DungeonRun {
  instanceId: string;
  completedAt: string;
  rewards: {
    experience: number;
    gold: number;
    items: unknown[];
  };
}

export interface GeneratedItem {
  id: string;
  templateId: string;
  name: string;
  rarity: string;
  itemLevel: number;
  stats: Record<string, number>;
  prefixes: string[];
  suffixes: string[];
  modifiers: unknown[];
}

export interface LootTable {
  id: string;
  name: string;
  itemLevel: number;
  description: string;
}

