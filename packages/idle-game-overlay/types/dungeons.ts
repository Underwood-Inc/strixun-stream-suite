/**
 * Dungeon System Types
 * 
 * Instanced dungeon content with bosses and rewards
 */

import { ItemRarity, GameItem } from './inventory';
import { GeneratedItem } from './loot';

// ================================
// Dungeon Types
// ================================

export type DungeonType = 
  | 'normal'
  | 'elite'
  | 'legendary'
  | 'mythic'
  | 'raid';

export type DungeonDifficulty = 
  | 'normal'
  | 'hard'
  | 'expert'
  | 'master'
  | 'nightmare';

export interface Dungeon {
  id: string;
  name: string;
  description: string;
  type: DungeonType;
  
  // Requirements
  requiredLevel: number;
  recommendedLevel: number;
  requiredItemLevel?: number;
  
  // Difficulty
  baseDifficulty: DungeonDifficulty;
  availableDifficulties: DungeonDifficulty[];
  
  // Structure
  floors: number;
  roomsPerFloor: number;
  estimatedTimeMinutes: number;
  
  // Rewards
  baseRewards: DungeonRewards;
  difficultyMultipliers: Record<DungeonDifficulty, number>;
  
  // Metadata
  isActive: boolean;
  unlockRequirements?: DungeonUnlockRequirement[];
}

// ================================
// Dungeon Instance
// ================================

export interface DungeonInstance {
  id: string;
  dungeonId: string;
  dungeon?: Dungeon;
  
  // Instance Info
  characterId: number;
  difficulty: DungeonDifficulty;
  instanceType: 'solo' | 'party' | 'raid'; // Party size
  
  // Progress
  currentFloor: number;
  currentRoom: number;
  completedRooms: number[];
  
  // State
  status: DungeonStatus;
  startedAt: Date;
  completedAt?: Date;
  
  // Rewards (collected)
  collectedRewards: DungeonRewards;
  
  // Party (if applicable)
  partyMembers?: Array<{
    characterId: number;
    characterName: string;
    isLeader: boolean;
  }>;
}

export type DungeonStatus = 
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'abandoned';

// ================================
// Dungeon Room
// ================================

export interface DungeonRoom {
  id: string;
  dungeonId: string;
  floor: number;
  roomNumber: number;
  
  // Room Type
  roomType: 'combat' | 'boss' | 'treasure' | 'puzzle' | 'rest';
  
  // Enemies (if combat/boss)
  enemies?: DungeonEnemy[];
  boss?: DungeonBoss;
  
  // Rewards (if treasure)
  treasureRewards?: DungeonRewards;
  
  // Puzzle (if puzzle room)
  puzzle?: DungeonPuzzle;
  
  // Connections
  nextRooms: string[]; // Room IDs
  previousRooms: string[]; // Room IDs
}

// ================================
// Dungeon Enemies
// ================================

export interface DungeonEnemy {
  id: string;
  name: string;
  level: number;
  type: 'normal' | 'elite' | 'mini_boss';
  
  // Stats
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  
  // Rewards
  dropTable: EnemyDropTable;
  
  // Behavior
  aiType: 'aggressive' | 'defensive' | 'support';
  abilities?: EnemyAbility[];
}

export interface DungeonBoss extends DungeonEnemy {
  type: 'boss';
  phase: number;
  maxPhases: number;
  phaseAbilities: Record<number, EnemyAbility[]>;
  guaranteedDrops: string[]; // Item template IDs
}

export interface EnemyAbility {
  id: string;
  name: string;
  type: 'attack' | 'defense' | 'heal' | 'buff' | 'debuff';
  cooldown: number;
  damage?: number;
  effect?: string;
}

export interface EnemyDropTable {
  guaranteed: Array<{
    itemTemplateId: string;
    quantity: number;
    chance: 100; // Always drops
  }>;
  random: Array<{
    itemTemplateId: string;
    quantity: number;
    chance: number; // 0-100
    rarity?: ItemRarity;
  }>;
}

// ================================
// Dungeon Rewards
// ================================

export interface DungeonRewards {
  experience: number;
  gold: number;
  items: Array<{
    item: GeneratedItem | GameItem;
    quantity: number;
    source: 'completion' | 'boss' | 'treasure' | 'enemy';
  }>;
  materials: Record<string, number>; // Material ID -> quantity
  currency?: Record<string, number>; // Special currencies
}

// ================================
// Dungeon Puzzle
// ================================

export interface DungeonPuzzle {
  id: string;
  type: 'memory' | 'pattern' | 'logic' | 'timing';
  description: string;
  solution: string; // Encrypted solution
  reward: DungeonRewards;
  attempts: number;
  maxAttempts: number;
}

// ================================
// Dungeon Unlock Requirements
// ================================

export interface DungeonUnlockRequirement {
  type: 'level' | 'quest' | 'dungeon' | 'achievement' | 'item';
  value: string | number;
  description: string;
}

// ================================
// Dungeon Actions
// ================================

export interface StartDungeonInput {
  characterId: number;
  dungeonId: string;
  difficulty: DungeonDifficulty;
  instanceType?: 'solo' | 'party';
  partyMembers?: number[]; // Character IDs
}

export interface StartDungeonResult {
  success: boolean;
  instance?: DungeonInstance;
  error?: string;
}

export interface CompleteDungeonRoomInput {
  instanceId: string;
  roomId: string;
  characterId: number;
  result: 'victory' | 'defeat' | 'skip';
}

export interface CompleteDungeonRoomResult {
  success: boolean;
  rewards?: DungeonRewards;
  nextRoom?: DungeonRoom;
  instance?: DungeonInstance;
  error?: string;
}

export interface CompleteDungeonInput {
  instanceId: string;
  characterId: number;
}

export interface CompleteDungeonResult {
  success: boolean;
  finalRewards?: DungeonRewards;
  instance?: DungeonInstance;
  error?: string;
}

// ================================
// Dungeon Leaderboard
// ================================

export interface DungeonLeaderboardEntry {
  rank: number;
  characterId: number;
  characterName: string;
  dungeonId: string;
  difficulty: DungeonDifficulty;
  completionTime: number; // Seconds
  completedAt: Date;
  score: number; // Calculated score
}

// ================================
// Dungeon Statistics
// ================================

export interface DungeonStatistics {
  characterId: number;
  totalDungeonsCompleted: number;
  totalDungeonsAttempted: number;
  fastestCompletions: Record<string, number>; // Dungeon ID -> time in seconds
  totalRewards: DungeonRewards;
  favoriteDungeon?: string;
  lastCompletedAt?: Date;
}

