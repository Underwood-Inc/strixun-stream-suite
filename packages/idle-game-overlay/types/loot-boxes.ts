/**
 * Daily Loot Box System Types
 * 
 * Retention-focused daily reward system
 */

import { ItemRarity, GameItem } from './inventory';
import { GeneratedItem } from './loot';

// ================================
// Loot Box Types
// ================================

export type LootBoxType = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'event'
  | 'achievement'
  | 'subscription';

export interface LootBox {
  id: string;
  type: LootBoxType;
  name: string;
  description: string;
  
  // Availability
  availableAt: Date;
  expiresAt: Date;
  claimedAt?: Date;
  
  // Reward pools
  rewardPools: LootBoxRewardPool[];
  
  // Streak bonuses
  streakDays: number; // Current streak
  streakBonus: number; // Multiplier (1.0 = base, 2.0 = double)
  
  // Requirements
  requiredLevel?: number;
  requiredSubscription?: 'starter' | 'pro' | 'enterprise';
  
  // Metadata
  isClaimed: boolean;
  isAvailable: boolean;
}

// ================================
// Reward Pools
// ================================

export interface LootBoxRewardPool {
  id: string;
  name: string;
  rarity: ItemRarity;
  weight: number; // Spawn weight
  
  // Rewards
  rewards: LootBoxReward[];
  
  // Guarantees
  guaranteedCount?: number; // Guaranteed items from this pool
  maxCount?: number; // Maximum items from this pool
}

export interface LootBoxReward {
  id: string;
  type: 'item' | 'currency' | 'material' | 'experience' | 'special';
  
  // Item reward
  itemTemplateId?: string;
  itemQuantity?: number;
  itemRarity?: ItemRarity;
  
  // Currency reward
  currencyType?: 'gold' | 'premium' | 'special';
  currencyAmount?: number;
  
  // Material reward
  materialId?: string;
  materialQuantity?: number;
  
  // Experience reward
  experienceAmount?: number;
  
  // Special reward
  specialRewardId?: string;
  specialRewardData?: Record<string, unknown>;
  
  // Weight (within pool)
  weight: number;
}

// ================================
// Loot Box Reward Result
// ================================

export interface LootBoxRewardResult {
  lootBoxId: string;
  claimedAt: Date;
  
  // Rewards received
  rewards: Array<{
    reward: LootBoxReward;
    item?: GeneratedItem | GameItem;
    quantity: number;
  }>;
  
  // Streak info
  streakDays: number;
  streakBonus: number;
  
  // Next available
  nextAvailableAt: Date;
}

// ================================
// Streak System
// ================================

export interface LootBoxStreak {
  characterId: number;
  currentStreak: number;
  longestStreak: number;
  lastClaimedAt: Date | null;
  streakBonus: number;
  streakTier: StreakTier;
}

export type StreakTier = 
  | 'none'      // 0 days
  | 'beginner'  // 1-3 days
  | 'dedicated' // 4-7 days
  | 'committed' // 8-14 days
  | 'loyal'     // 15-30 days
  | 'legendary'; // 31+ days

export interface StreakTierInfo {
  tier: StreakTier;
  minDays: number;
  maxDays: number;
  bonusMultiplier: number;
  displayName: string;
  color: string;
}

export const STREAK_TIERS: Record<StreakTier, StreakTierInfo> = {
  none: {
    tier: 'none',
    minDays: 0,
    maxDays: 0,
    bonusMultiplier: 1.0,
    displayName: 'No Streak',
    color: '#9d9d9d'
  },
  beginner: {
    tier: 'beginner',
    minDays: 1,
    maxDays: 3,
    bonusMultiplier: 1.0,
    displayName: 'Beginner',
    color: '#ffffff'
  },
  dedicated: {
    tier: 'dedicated',
    minDays: 4,
    maxDays: 7,
    bonusMultiplier: 1.1,
    displayName: 'Dedicated',
    color: '#1eff00'
  },
  committed: {
    tier: 'committed',
    minDays: 8,
    maxDays: 14,
    bonusMultiplier: 1.25,
    displayName: 'Committed',
    color: '#0070dd'
  },
  loyal: {
    tier: 'loyal',
    minDays: 15,
    maxDays: 30,
    bonusMultiplier: 1.5,
    displayName: 'Loyal',
    color: '#a335ee'
  },
  legendary: {
    tier: 'legendary',
    minDays: 31,
    maxDays: Infinity,
    bonusMultiplier: 2.0,
    displayName: 'Legendary',
    color: '#ff8000'
  }
};

// ================================
// Default Reward Pools
// ================================

export const DEFAULT_DAILY_LOOT_BOX_POOLS: LootBoxRewardPool[] = [
  {
    id: 'common',
    name: 'Common Rewards',
    rarity: 'common',
    weight: 60,
    rewards: [
      {
        id: 'gold_small',
        type: 'currency',
        currencyType: 'gold',
        currencyAmount: 100,
        weight: 40
      },
      {
        id: 'material_common',
        type: 'material',
        materialId: 'iron_ore',
        materialQuantity: 5,
        weight: 30
      },
      {
        id: 'experience_small',
        type: 'experience',
        experienceAmount: 50,
        weight: 30
      }
    ]
  },
  {
    id: 'uncommon',
    name: 'Uncommon Rewards',
    rarity: 'uncommon',
    weight: 25,
    rewards: [
      {
        id: 'gold_medium',
        type: 'currency',
        currencyType: 'gold',
        currencyAmount: 500,
        weight: 50
      },
      {
        id: 'item_uncommon',
        type: 'item',
        itemTemplateId: 'potion_health',
        itemQuantity: 3,
        itemRarity: 'uncommon',
        weight: 50
      }
    ]
  },
  {
    id: 'rare',
    name: 'Rare Rewards',
    rarity: 'rare',
    weight: 10,
    rewards: [
      {
        id: 'gold_large',
        type: 'currency',
        currencyType: 'gold',
        currencyAmount: 2000,
        weight: 40
      },
      {
        id: 'item_rare',
        type: 'item',
        itemTemplateId: 'equipment_rare',
        itemQuantity: 1,
        itemRarity: 'rare',
        weight: 60
      }
    ]
  },
  {
    id: 'epic',
    name: 'Epic Rewards',
    rarity: 'epic',
    weight: 4,
    rewards: [
      {
        id: 'item_epic',
        type: 'item',
        itemTemplateId: 'equipment_epic',
        itemQuantity: 1,
        itemRarity: 'epic',
        weight: 100
      }
    ]
  },
  {
    id: 'legendary',
    name: 'Legendary Rewards',
    rarity: 'legendary',
    weight: 0.9,
    rewards: [
      {
        id: 'item_legendary',
        type: 'item',
        itemTemplateId: 'equipment_legendary',
        itemQuantity: 1,
        itemRarity: 'legendary',
        weight: 100
      }
    ]
  },
  {
    id: 'unique',
    name: 'Unique Rewards',
    rarity: 'unique',
    weight: 0.1,
    rewards: [
      {
        id: 'item_unique',
        type: 'item',
        itemTemplateId: 'equipment_unique',
        itemQuantity: 1,
        itemRarity: 'unique',
        weight: 100
      }
    ]
  }
];

// ================================
// Loot Box Actions
// ================================

export interface ClaimLootBoxInput {
  characterId: number;
  lootBoxId: string;
}

export interface ClaimLootBoxResult {
  success: boolean;
  rewardResult?: LootBoxRewardResult;
  error?: string;
}

export interface GetLootBoxStatusInput {
  characterId: number;
  lootBoxType?: LootBoxType;
}

export interface GetLootBoxStatusResult {
  available: LootBox[];
  claimed: LootBox[];
  nextAvailableAt: Date | null;
  streak: LootBoxStreak;
}

