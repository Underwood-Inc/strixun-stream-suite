/**
 * Idle Mechanics Types
 * 
 * Offline progress and resource generation
 */

// ================================
// Idle Progress
// ================================

export interface IdleProgress {
  characterId: number;
  lastActiveAt: Date;
  offlineHours: number;
  maxOfflineHours: number; // Based on subscription tier
  
  // Resource generation rates (per hour)
  resourceRates: {
    gold: number;
    experience: number;
    materials: Record<string, number>; // Material ID -> rate
  };
  
  // Calculated rewards
  rewards: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: IdleGeneratedItem[];
  };
  
  // Activity tracking
  activities: IdleActivity[];
}

export interface IdleGeneratedItem {
  itemTemplateId: string;
  quantity: number;
  quality?: number;
  rarity?: string;
  source: 'mining' | 'crafting' | 'combat' | 'gathering';
}

// ================================
// Idle Activities
// ================================

export interface IdleActivity {
  id: string;
  type: IdleActivityType;
  name: string;
  description: string;
  
  // Generation
  resourceRates: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
  };
  
  // Requirements
  requiredLevel: number;
  requiredSkill?: string;
  requiredSkillLevel?: number;
  requiredEquipment?: string[]; // Item template IDs
  
  // Limits
  maxConcurrent: number; // How many can run at once
  unlockCost?: number;
  
  // Status
  isUnlocked: boolean;
  isActive: boolean;
  startedAt?: Date;
}

export type IdleActivityType = 
  | 'auto_mining'
  | 'auto_woodcutting'
  | 'auto_fishing'
  | 'auto_combat'
  | 'auto_crafting'
  | 'auto_gathering'
  | 'passive_income'
  | 'research';

// ================================
// Idle Activity Slots
// ================================

export interface IdleActivitySlot {
  slotIndex: number;
  activityId: string | null;
  activity?: IdleActivity;
  startedAt: Date | null;
  progress: number; // 0-100
  isActive: boolean;
}

export interface IdleActivitySlots {
  characterId: number;
  maxSlots: number; // Based on subscription tier
  slots: IdleActivitySlot[];
  usedSlots: number;
}

// ================================
// Offline Progress Calculation
// ================================

export interface OfflineProgressInput {
  lastActiveAt: Date;
  currentTime: Date;
  maxOfflineHours: number;
  activeActivities: IdleActivity[];
  resourceRates: IdleProgress['resourceRates'];
  subscriptionTier: string;
}

export interface OfflineProgressResult {
  offlineHours: number;
  cappedHours: number; // Hours that count (capped at max)
  rewards: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: IdleGeneratedItem[];
  };
  activities: Array<{
    activityId: string;
    progress: number;
    rewards: {
      gold: number;
      experience: number;
      materials: Record<string, number>;
    };
  }>;
}

// ================================
// Idle Activity Actions
// ================================

export interface StartIdleActivityInput {
  characterId: number;
  activityId: string;
  slotIndex?: number; // Optional, auto-assigns if not provided
}

export interface StartIdleActivityResult {
  success: boolean;
  slot?: IdleActivitySlot;
  error?: string;
}

export interface StopIdleActivityInput {
  characterId: number;
  slotIndex: number;
}

export interface StopIdleActivityResult {
  success: boolean;
  rewards?: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: IdleGeneratedItem[];
  };
  error?: string;
}

export interface ClaimIdleRewardsInput {
  characterId: number;
  slotIndex?: number; // If not provided, claims all
}

export interface ClaimIdleRewardsResult {
  success: boolean;
  rewards?: {
    gold: number;
    experience: number;
    materials: Record<string, number>;
    items: IdleGeneratedItem[];
  };
  error?: string;
}

// ================================
// Idle Activity Limits
// ================================

export interface IdleActivityLimits {
  free: {
    maxSlots: 1;
    maxOfflineHours: 8;
    offlineMultiplier: 0.5;
  };
  starter: {
    maxSlots: 2;
    maxOfflineHours: 16;
    offlineMultiplier: 0.75;
  };
  pro: {
    maxSlots: 5;
    maxOfflineHours: 24;
    offlineMultiplier: 1.0;
  };
  enterprise: {
    maxSlots: 10;
    maxOfflineHours: 48;
    offlineMultiplier: 1.5;
  };
}

export const IDLE_ACTIVITY_LIMITS: IdleActivityLimits = {
  free: {
    maxSlots: 1,
    maxOfflineHours: 8,
    offlineMultiplier: 0.5
  },
  starter: {
    maxSlots: 2,
    maxOfflineHours: 16,
    offlineMultiplier: 0.75
  },
  pro: {
    maxSlots: 5,
    maxOfflineHours: 24,
    offlineMultiplier: 1.0
  },
  enterprise: {
    maxSlots: 10,
    maxOfflineHours: 48,
    offlineMultiplier: 1.5
  }
};

