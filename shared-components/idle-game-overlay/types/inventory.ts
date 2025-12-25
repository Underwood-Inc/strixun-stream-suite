/**
 * Inventory Types
 * 
 * Re-exported from existing idling.app__UI types with extensions
 */

// Re-export core types (these should match the existing system)
export type ItemRarity = 
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'unique';

export interface ItemStats {
  // Combat Stats
  attack?: number;
  defense?: number;
  attackSpeed?: number;
  critChance?: number;
  critDamage?: number;
  
  // Vitals
  healthBonus?: number;
  energyBonus?: number;
  healthRegen?: number;
  energyRegen?: number;
  
  // Core Stats
  strengthBonus?: number;
  dexterityBonus?: number;
  intelligenceBonus?: number;
  enduranceBonus?: number;
  
  // Gathering
  miningSpeed?: number;
  miningPower?: number;
  woodcuttingSpeed?: number;
  woodcuttingPower?: number;
  fishingSpeed?: number;
  fishingLuck?: number;
  
  // Crafting
  craftingBonus?: number;
  craftingSpeed?: number;
  
  // Special
  experienceBonus?: number;
  goldFindBonus?: number;
  itemFindBonus?: number;
}

export interface ItemTemplate {
  id: number;
  itemCode: string;
  displayName: string;
  description: string;
  itemType: string;
  itemSubtype?: string;
  rarity: ItemRarity;
  baseStats: ItemStats;
  spriteId?: string;
  iconId?: string;
  maxStack: number;
  isTradeable: boolean;
  isCraftable: boolean;
  requiredLevel: number;
  baseSellPrice: number;
  isActive: boolean;
}

export interface GameItem {
  id: number;
  templateId: number;
  template?: ItemTemplate;
  ownerCharacterId?: number;
  quantity: number;
  statModifiers: ItemStats;
  itemUuid: string;
  createdAt: Date;
  updatedAt: Date;
}

