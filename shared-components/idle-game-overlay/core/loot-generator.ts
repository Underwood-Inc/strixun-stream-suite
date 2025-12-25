/**
 * Loot Generator - Path of Exile Style
 * 
 * Generates items with complex prefix/suffix modifiers
 */

import {
  ItemModifier,
  ModifierPool,
  LootTable,
  GeneratedItem,
  LootGenerationOptions,
  LootGenerationResult,
  ModifierGenerationResult,
  DEFAULT_MODIFIER_COUNTS,
  DEFAULT_DROP_CHANCES
} from '../types/loot';
import { ItemRarity, ItemTemplate, ItemStats } from '../types/inventory';

// ================================
// Loot Generator Class
// ================================

export class LootGenerator {
  private lootTables: Map<string, LootTable>;
  private modifierPools: Map<string, ModifierPool>;
  private modifiers: Map<string, ItemModifier>;

  constructor() {
    this.lootTables = new Map();
    this.modifierPools = new Map();
    this.modifiers = new Map();
  }

  /**
   * Register a loot table
   */
  registerLootTable(lootTable: LootTable): void {
    this.lootTables.set(lootTable.id, lootTable);
    
    // Register modifier pools
    [...lootTable.prefixPools, ...lootTable.suffixPools].forEach(pool => {
      this.modifierPools.set(pool.id, pool);
      
      // Register modifiers
      pool.modifiers.forEach(modifier => {
        this.modifiers.set(modifier.id, modifier);
      });
    });
  }

  /**
   * Generate an item from a loot table
   */
  generateItem(
    lootTableId: string,
    options: Partial<LootGenerationOptions> = {}
  ): LootGenerationResult {
    const lootTable = this.lootTables.get(lootTableId);
    if (!lootTable) {
      return {
        success: false,
        error: `Loot table not found: ${lootTableId}`
      };
    }

    try {
      // Determine item level
      const itemLevel = options.itemLevel || lootTable.itemLevel;

      // Roll rarity
      const rarity = this.rollRarity(
        lootTable,
        options.forcedRarity,
        options.seed
      );

      // Get modifier counts for this rarity
      const modifierCounts = lootTable.modifierCounts[rarity];
      const minModifiers = options.minModifiers ?? 
        (modifierCounts.minPrefixes + modifierCounts.minSuffixes);
      const maxModifiers = options.maxModifiers ?? 
        (modifierCounts.maxPrefixes + modifierCounts.maxSuffixes);

      // Generate modifiers
      const modifierResult = this.generateModifiers(
        lootTable,
        rarity,
        itemLevel,
        modifierCounts,
        minModifiers,
        maxModifiers,
        options.seed
      );

      // Calculate final stats
      const finalStats = this.calculateFinalStats(
        lootTable.baseRarity === rarity ? lootTable : undefined,
        modifierResult.prefixes,
        modifierResult.suffixes
      );

      // Generate item name
      const fullName = this.generateItemName(
        lootTable.name,
        modifierResult.prefixes,
        modifierResult.suffixes
      );

      // Generate color palette based on rarity
      const colorPalette = this.generateColorPalette(rarity);

      const generatedItem: GeneratedItem = {
        template: this.createItemTemplate(lootTable, rarity),
        baseName: lootTable.name,
        fullName,
        rarity,
        itemLevel,
        prefixes: modifierResult.prefixes,
        suffixes: modifierResult.suffixes,
        finalStats,
        colorPalette,
        generatedAt: new Date(),
        seed: options.seed
      };

      return {
        success: true,
        item: generatedItem
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Roll item rarity based on drop chances
   */
  private rollRarity(
    lootTable: LootTable,
    forcedRarity?: ItemRarity,
    seed?: string
  ): ItemRarity {
    if (forcedRarity) {
      return forcedRarity;
    }

    const random = seed ? this.seededRandom(seed) : Math.random();
    const roll = random * 100;

    let cumulative = 0;
    const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'];

    for (const rarity of rarities) {
      cumulative += lootTable.dropChances[rarity];
      if (roll <= cumulative) {
        return rarity;
      }
    }

    return 'common'; // Fallback
  }

  /**
   * Generate modifiers (prefixes and suffixes)
   */
  private generateModifiers(
    lootTable: LootTable,
    rarity: ItemRarity,
    itemLevel: number,
    modifierCounts: LootTable['modifierCounts'][ItemRarity],
    minModifiers: number,
    maxModifiers: number,
    seed?: string
  ): ModifierGenerationResult {
    const prefixes: ItemModifier[] = [];
    const suffixes: ItemModifier[] = [];

    // Determine actual modifier counts
    const random = seed ? this.seededRandom(seed + '_modifiers') : Math.random();
    const prefixCount = Math.floor(
      random * (modifierCounts.maxPrefixes - modifierCounts.minPrefixes + 1)
    ) + modifierCounts.minPrefixes;

    const suffixCount = Math.floor(
      random * (modifierCounts.maxSuffixes - modifierCounts.minSuffixes + 1)
    ) + modifierCounts.minSuffixes;

    // Ensure we meet minimum total modifiers
    const totalModifiers = prefixCount + suffixCount;
    if (totalModifiers < minModifiers) {
      const needed = minModifiers - totalModifiers;
      if (prefixCount < modifierCounts.maxPrefixes) {
        prefixes.push(...this.selectModifiers(
          lootTable.prefixPools,
          rarity,
          itemLevel,
          needed,
          seed ? seed + '_prefix_boost' : undefined
        ));
      } else {
        suffixes.push(...this.selectModifiers(
          lootTable.suffixPools,
          rarity,
          itemLevel,
          needed,
          seed ? seed + '_suffix_boost' : undefined
        ));
      }
    }

    // Select prefixes
    if (prefixCount > 0) {
      prefixes.push(...this.selectModifiers(
        lootTable.prefixPools,
        rarity,
        itemLevel,
        prefixCount,
        seed ? seed + '_prefixes' : undefined
      ));
    }

    // Select suffixes
    if (suffixCount > 0) {
      suffixes.push(...this.selectModifiers(
        lootTable.suffixPools,
        rarity,
        itemLevel,
        suffixCount,
        seed ? seed + '_suffixes' : undefined
      ));
    }

    return {
      prefixes,
      suffixes,
      totalModifierCount: prefixes.length + suffixes.length
    };
  }

  /**
   * Select modifiers from pools
   */
  private selectModifiers(
    pools: ModifierPool[],
    rarity: ItemRarity,
    itemLevel: number,
    count: number,
    seed?: string
  ): ItemModifier[] {
    const selected: ItemModifier[] = [];
    const usedModifierIds = new Set<string>();

    // Filter pools by rarity and item level
    const availablePools = pools.filter(pool => {
      return pool.rarity === rarity &&
        itemLevel >= pool.itemLevelRange.min &&
        itemLevel <= pool.itemLevelRange.max;
    });

    if (availablePools.length === 0) {
      return selected;
    }

    // Calculate total weight
    const totalWeight = availablePools.reduce((sum, pool) => sum + pool.weight, 0);

    for (let i = 0; i < count; i++) {
      // Select a pool
      const random = seed ? this.seededRandom(seed + `_pool_${i}`) : Math.random();
      let weightSum = 0;
      const roll = random * totalWeight;

      let selectedPool: ModifierPool | null = null;
      for (const pool of availablePools) {
        weightSum += pool.weight;
        if (roll <= weightSum) {
          selectedPool = pool;
          break;
        }
      }

      if (!selectedPool) {
        selectedPool = availablePools[availablePools.length - 1];
      }

      // Select a modifier from the pool
      const availableModifiers = selectedPool.modifiers.filter(
        mod => !usedModifierIds.has(mod.id) &&
          itemLevel >= mod.itemLevel
      );

      if (availableModifiers.length === 0) {
        continue; // Skip if no available modifiers
      }

      // Weighted random selection
      const modRandom = seed ? this.seededRandom(seed + `_mod_${i}`) : Math.random();
      const modIndex = Math.floor(modRandom * availableModifiers.length);
      const selectedModifier = availableModifiers[modIndex];

      selected.push(selectedModifier);
      usedModifierIds.add(selectedModifier.id);
    }

    return selected;
  }

  /**
   * Calculate final stats from base + modifiers
   */
  private calculateFinalStats(
    baseStats?: ItemStats,
    prefixes: ItemModifier[],
    suffixes: ItemModifier[]
  ): ItemStats {
    const finalStats: ItemStats = { ...baseStats };

    // Apply all modifier stats
    [...prefixes, ...suffixes].forEach(modifier => {
      Object.entries(modifier.statModifiers).forEach(([key, value]) => {
        if (value !== undefined) {
          const statKey = key as keyof ItemStats;
          const currentValue = finalStats[statKey] || 0;
          finalStats[statKey] = (currentValue + value) as any;
        }
      });
    });

    return finalStats;
  }

  /**
   * Generate item name with prefixes and suffixes
   */
  private generateItemName(
    baseName: string,
    prefixes: ItemModifier[],
    suffixes: ItemModifier[]
  ): string {
    const prefixNames = prefixes.map(p => p.name);
    const suffixNames = suffixes.map(s => s.name);

    const parts: string[] = [];
    if (prefixNames.length > 0) {
      parts.push(prefixNames.join(' '));
    }
    parts.push(baseName);
    if (suffixNames.length > 0) {
      parts.push(suffixNames.join(' '));
    }

    return parts.join(' ');
  }

  /**
   * Generate color palette based on rarity
   */
  private generateColorPalette(rarity: ItemRarity): {
    primary: string;
    secondary: string;
    glow?: string;
  } {
    const palettes: Record<ItemRarity, { primary: string; secondary: string; glow?: string }> = {
      common: { primary: '#9d9d9d', secondary: '#6b6b6b' },
      uncommon: { primary: '#1eff00', secondary: '#15cc00' },
      rare: { primary: '#0070dd', secondary: '#005ab1', glow: '#3f9fff' },
      epic: { primary: '#a335ee', secondary: '#8229be', glow: '#c05fff' },
      legendary: { primary: '#ff8000', secondary: '#cc6600', glow: '#ffab4f' },
      unique: { primary: '#e6cc80', secondary: '#b8a366', glow: '#fff0b3' }
    };

    return palettes[rarity];
  }

  /**
   * Create item template from loot table
   */
  private createItemTemplate(lootTable: LootTable, rarity: ItemRarity): ItemTemplate {
    return {
      id: 0, // Will be assigned by database
      itemCode: `${lootTable.id}_${rarity}`,
      displayName: lootTable.name,
      description: `Generated ${rarity} item`,
      itemType: 'equipment',
      rarity,
      baseStats: {},
      maxStack: 1,
      isTradeable: true,
      isCraftable: false,
      requiredLevel: lootTable.itemLevel,
      baseSellPrice: this.calculateBasePrice(rarity, lootTable.itemLevel),
      isActive: true
    };
  }

  /**
   * Calculate base price based on rarity and level
   */
  private calculateBasePrice(rarity: ItemRarity, itemLevel: number): number {
    const rarityMultipliers: Record<ItemRarity, number> = {
      common: 1,
      uncommon: 2,
      rare: 5,
      epic: 10,
      legendary: 25,
      unique: 50
    };

    return Math.floor(itemLevel * 10 * rarityMultipliers[rarity]);
  }

  /**
   * Seeded random number generator (for deterministic generation)
   */
  private seededRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to 0-1 range
    return Math.abs(hash) / 2147483647;
  }
}

// ================================
// Default Loot Generator Instance
// ================================

export const defaultLootGenerator = new LootGenerator();

