/**
 * Loot System Types
 * 
 * Path of Exile-style loot generation with prefixes and suffixes
 */

import { ItemRarity, ItemStats, ItemTemplate } from './inventory';

// ================================
// Item Modifiers (Prefixes/Suffixes)
// ================================

export interface ItemModifier {
  id: string;
  name: string; // "of the Bear", "Fiery", etc.
  type: 'prefix' | 'suffix';
  tier: 1 | 2 | 3 | 4 | 5; // Higher tier = better stats
  rarity: ItemRarity; // Affects spawn chance
  statModifiers: ItemStats; // What stats it modifies
  tags: string[]; // "combat", "defense", "elemental", etc.
  itemLevel: number; // Minimum item level required
  requiredItemTypes?: string[]; // Which item types can have this modifier
}

// ================================
// Modifier Pools
// ================================

export interface ModifierPool {
  id: string;
  name: string;
  type: 'prefix' | 'suffix';
  rarity: ItemRarity;
  modifiers: ItemModifier[];
  weight: number; // Spawn weight (higher = more common)
  itemLevelRange: {
    min: number;
    max: number;
  };
  tags: string[]; // Compatible item tags
}

// ================================
// Loot Table
// ================================

export interface LootTable {
  id: string;
  name: string;
  itemLevel: number; // Base item level
  baseRarity: ItemRarity; // Base rarity roll
  
  // Prefix/Suffix pools
  prefixPools: ModifierPool[];
  suffixPools: ModifierPool[];
  
  // Drop chances (percentages)
  dropChances: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
    unique: number;
  };
  
  // Modifier count ranges (based on rarity)
  modifierCounts: {
    [key in ItemRarity]: {
      minPrefixes: number;
      maxPrefixes: number;
      minSuffixes: number;
      maxSuffixes: number;
    };
  };
  
  // Item type restrictions
  allowedItemTypes?: string[];
  allowedItemSubtypes?: string[];
}

// ================================
// Generated Item
// ================================

export interface GeneratedItem {
  template: ItemTemplate;
  baseName: string;
  fullName: string; // With prefixes/suffixes
  rarity: ItemRarity;
  itemLevel: number;
  
  // Modifiers
  prefixes: ItemModifier[];
  suffixes: ItemModifier[];
  
  // Final stats (base + all modifiers)
  finalStats: ItemStats;
  
  // Visual
  colorPalette?: {
    primary: string;
    secondary: string;
    glow?: string;
  };
  
  // Metadata
  generatedAt: Date;
  seed?: string; // For deterministic generation
}

// ================================
// Loot Generation Result
// ================================

export interface LootGenerationResult {
  success: boolean;
  item?: GeneratedItem;
  error?: string;
  warnings?: string[];
}

// ================================
// Loot Generation Options
// ================================

export interface LootGenerationOptions {
  lootTableId: string;
  itemLevel?: number; // Override base item level
  forcedRarity?: ItemRarity; // Force a specific rarity
  minModifiers?: number; // Minimum total modifiers
  maxModifiers?: number; // Maximum total modifiers
  seed?: string; // For deterministic generation
  allowUnique?: boolean; // Allow unique items
}

// ================================
// Modifier Generation
// ================================

export interface ModifierGenerationResult {
  prefixes: ItemModifier[];
  suffixes: ItemModifier[];
  totalModifierCount: number;
}

// ================================
// Default Modifier Counts
// ================================

export const DEFAULT_MODIFIER_COUNTS: LootTable['modifierCounts'] = {
  common: {
    minPrefixes: 0,
    maxPrefixes: 0,
    minSuffixes: 0,
    maxSuffixes: 0
  },
  uncommon: {
    minPrefixes: 0,
    maxPrefixes: 1,
    minSuffixes: 0,
    maxSuffixes: 1
  },
  rare: {
    minPrefixes: 1,
    maxPrefixes: 2,
    minSuffixes: 1,
    maxSuffixes: 2
  },
  epic: {
    minPrefixes: 2,
    maxPrefixes: 3,
    minSuffixes: 2,
    maxSuffixes: 3
  },
  legendary: {
    minPrefixes: 3,
    maxPrefixes: 4,
    minSuffixes: 3,
    maxSuffixes: 4
  },
  unique: {
    minPrefixes: 4,
    maxPrefixes: 6,
    minSuffixes: 4,
    maxSuffixes: 6
  }
};

// ================================
// Default Drop Chances
// ================================

export const DEFAULT_DROP_CHANCES: LootTable['dropChances'] = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.9,
  unique: 0.1
};

