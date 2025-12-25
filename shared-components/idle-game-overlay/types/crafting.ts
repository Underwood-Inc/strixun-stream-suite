/**
 * End-Game Crafting Types
 * 
 * Advanced crafting system with modifiers and quality tiers
 */

import { ItemTemplate, ItemStats, ItemRarity } from './inventory';
import { ItemModifier } from './loot';

// ================================
// Crafting Tiers
// ================================

export type CraftingTier = 
  | 'basic'
  | 'intermediate'
  | 'advanced'
  | 'master'
  | 'legendary'
  | 'transcendent';

export interface CraftingTierInfo {
  tier: CraftingTier;
  displayName: string;
  requiredLevel: number;
  requiredSkill: number;
  unlockCost?: number;
  maxQuality: number;
  maxModifiers: number;
  modifierTierRange: {
    min: number;
    max: number;
  };
}

export const CRAFTING_TIERS: Record<CraftingTier, CraftingTierInfo> = {
  basic: {
    tier: 'basic',
    displayName: 'Basic',
    requiredLevel: 1,
    requiredSkill: 1,
    maxQuality: 50,
    maxModifiers: 0,
    modifierTierRange: { min: 0, max: 0 }
  },
  intermediate: {
    tier: 'intermediate',
    displayName: 'Intermediate',
    requiredLevel: 10,
    requiredSkill: 25,
    maxQuality: 70,
    maxModifiers: 2,
    modifierTierRange: { min: 1, max: 2 }
  },
  advanced: {
    tier: 'advanced',
    displayName: 'Advanced',
    requiredLevel: 25,
    requiredSkill: 50,
    maxQuality: 85,
    maxModifiers: 4,
    modifierTierRange: { min: 2, max: 3 }
  },
  master: {
    tier: 'master',
    displayName: 'Master',
    requiredLevel: 50,
    requiredSkill: 75,
    unlockCost: 10000,
    maxQuality: 95,
    maxModifiers: 6,
    modifierTierRange: { min: 3, max: 4 }
  },
  legendary: {
    tier: 'legendary',
    displayName: 'Legendary',
    requiredLevel: 75,
    requiredSkill: 90,
    unlockCost: 50000,
    maxQuality: 100,
    maxModifiers: 8,
    modifierTierRange: { min: 4, max: 5 }
  },
  transcendent: {
    tier: 'transcendent',
    displayName: 'Transcendent',
    requiredLevel: 99,
    requiredSkill: 99,
    unlockCost: 250000,
    maxQuality: 120, // Can exceed 100
    maxModifiers: 10,
    modifierTierRange: { min: 5, max: 5 }
  }
};

// ================================
// Crafting Recipe (Enhanced)
// ================================

export interface EndGameCraftingRecipe {
  id: number;
  recipeCode: string;
  displayName: string;
  description?: string;
  
  // Tier
  craftingTier: CraftingTier;
  
  // Output
  outputTemplateId: number;
  outputTemplate?: ItemTemplate;
  outputQuantity: number;
  outputQualityRange: {
    min: number;
    max: number;
  };
  outputRarity: ItemRarity; // Base rarity
  
  // Requirements
  requiredSkill: string;
  requiredSkillLevel: number;
  requiredCharacterLevel: number;
  requiredSubscription?: 'starter' | 'pro' | 'enterprise';
  
  // Crafting Properties
  craftingTimeSeconds: number;
  experienceReward: number;
  
  // Modifier System
  allowsModifiers: boolean;
  modifierPools?: {
    prefixPools: string[]; // Pool IDs
    suffixPools: string[]; // Pool IDs
  };
  guaranteedModifiers?: number; // Guaranteed modifier count
  maxModifiers?: number; // Maximum modifier count
  
  // Ingredients
  ingredients: RecipeIngredient[];
  
  // Special Materials (end-game)
  specialMaterials?: SpecialMaterial[];
  
  // Discovery
  isDiscoveredByDefault: boolean;
  discoveryHint?: string;
  
  // Metadata
  isActive: boolean;
}

export interface RecipeIngredient {
  id: number;
  recipeId: number;
  itemTemplateId: number;
  itemTemplate?: ItemTemplate;
  quantityRequired: number;
  isConsumed: boolean;
  qualityBonus?: number; // Quality of ingredient affects output
}

export interface SpecialMaterial {
  id: string;
  name: string;
  type: 'essence' | 'catalyst' | 'fragment' | 'orb';
  effect: SpecialMaterialEffect;
  rarity: ItemRarity;
  quantityRequired: number;
}

export interface SpecialMaterialEffect {
  type: 'quality_boost' | 'modifier_boost' | 'rarity_boost' | 'guaranteed_modifier';
  value: number;
  description: string;
}

// ================================
// Crafting Session (Enhanced)
// ================================

export interface EndGameCraftingSession {
  id: string;
  characterId: number;
  recipeId: number;
  recipe?: EndGameCraftingRecipe;
  
  // Progress
  startedAt: Date;
  completesAt: Date;
  progressPercent: number;
  
  // Quality & Modifiers
  expectedQuality: number;
  expectedModifiers: number;
  appliedMaterials: SpecialMaterial[];
  
  // Status
  status: CraftingStatus;
  
  // Result (when complete)
  resultItemId?: number;
  resultQuality?: number;
  resultModifiers?: {
    prefixes: ItemModifier[];
    suffixes: ItemModifier[];
  };
}

export type CraftingStatus = 
  | 'in_progress'
  | 'completed'
  | 'collected'
  | 'cancelled'
  | 'failed';

// ================================
// Crafting Actions
// ================================

export interface StartEndGameCraftingInput {
  characterId: number;
  recipeId: number;
  quantity?: number;
  specialMaterials?: Array<{
    materialId: string;
    quantity: number;
  }>;
}

export interface StartEndGameCraftingResult {
  success: boolean;
  session?: EndGameCraftingSession;
  error?: string;
}

export interface CollectEndGameCraftingResult {
  success: boolean;
  items?: Array<{
    itemId: number;
    quantity: number;
    quality: number;
    modifiers?: {
      prefixes: ItemModifier[];
      suffixes: ItemModifier[];
    };
  }>;
  experienceGained?: number;
  error?: string;
}

// ================================
// Quality Calculation
// ================================

export interface QualityCalculationInput {
  skillLevel: number;
  recipe: EndGameCraftingRecipe;
  ingredientQuality: number; // Average quality of ingredients
  specialMaterials: SpecialMaterial[];
  qualityBonus: number; // From subscription/equipment
}

export interface QualityCalculationResult {
  baseQuality: number;
  finalQuality: number;
  qualityModifiers: Array<{
    source: string;
    value: number;
  }>;
}

// ================================
// Modifier Application
// ================================

export interface ModifierApplicationResult {
  prefixes: ItemModifier[];
  suffixes: ItemModifier[];
  totalModifierCount: number;
  appliedModifiers: Array<{
    modifier: ItemModifier;
    source: 'recipe' | 'material' | 'random';
  }>;
}

