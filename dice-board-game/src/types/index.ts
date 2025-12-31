/**
 * Core types for the dice board game
 */

export interface HexCoordinate {
  q: number;
  r: number;
  s: number;
}

export interface BoardTile extends HexCoordinate {
  id: string;
  type: TileType;
  eventId?: string;
  connections: string[]; // IDs of connected tiles
  isFork?: boolean;
  forkPaths?: string[][]; // Array of path arrays for forks
}

export type TileType = 
  | 'normal'
  | 'event'
  | 'combat'
  | 'treasure'
  | 'shop'
  | 'rest'
  | 'boss'
  | 'start'
  | 'finish';

export interface BoardConfig {
  width: number;
  height: number;
  tileSize: number;
  wrapEdges: boolean;
  forkProbability: number; // 0-1, probability of fork at junction
  minForkChainLength: number; // Minimum tiles before fork can occur
}

export interface DiceConfig {
  sides: number;
  count: number;
  color?: string;
  material?: 'standard' | 'metal' | 'wood' | 'crystal';
  texture?: string;
  size?: number;
}

export interface DiceRoll {
  dice: number[];
  total: number;
  timestamp: number;
}

export interface Player {
  id: string;
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  inventory: Item[];
  buffs: Buff[];
  debuffs: Debuff[];
  stats: PlayerStats;
}

export interface PlayerStats {
  strength: number;
  agility: number;
  intelligence: number;
  luck: number;
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  stats?: Partial<PlayerStats>;
  effects?: Effect[];
  description: string;
}

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'accessory' | 'special';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Buff {
  id: string;
  name: string;
  description: string;
  duration: number; // turns remaining
  effects: Effect[];
}

export interface Debuff {
  id: string;
  name: string;
  description: string;
  duration: number; // turns remaining
  effects: Effect[];
}

export interface Effect {
  type: EffectType;
  value: number;
  target?: 'health' | 'stats' | 'movement' | 'dice';
}

export type EffectType = 
  | 'heal'
  | 'damage'
  | 'stat_boost'
  | 'stat_reduction'
  | 'extra_dice'
  | 'double_roll'
  | 'move_backward'
  | 'move_forward'
  | 'teleport'
  | 'immunity';

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  rarity: Rarity;
  outcomes: EventOutcome[];
  requiresCombat?: boolean;
  combatDifficulty?: number;
}

export type EventType = 
  | 'treasure'
  | 'combat'
  | 'npc'
  | 'trap'
  | 'shrine'
  | 'merchant'
  | 'random'
  | 'quest';

export interface EventOutcome {
  probability: number; // 0-1
  type: 'item' | 'buff' | 'debuff' | 'damage' | 'heal' | 'gold' | 'experience' | 'movement' | 'dialogue' | 'quest';
  value: unknown;
  description: string;
}

export interface CombatEncounter {
  id: string;
  enemy: Enemy;
  difficulty: number;
  rewards: CombatReward[];
}

export interface Enemy {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  abilities: EnemyAbility[];
}

export interface EnemyAbility {
  name: string;
  description: string;
  damage: number;
  cooldown: number;
}

export interface CombatReward {
  type: 'item' | 'gold' | 'experience';
  value: unknown;
}

export interface NPCEncounter {
  id: string;
  npc: NPC;
  dialogue: DialogueNode[];
  options: DialogueOption[];
}

export interface NPC {
  id: string;
  name: string;
  type: NPCType;
  personality: string[];
}

export type NPCType = 'merchant' | 'quest_giver' | 'healer' | 'trainer' | 'storyteller' | 'random';

export interface DialogueNode {
  id: string;
  text: string;
  speaker: 'npc' | 'player';
  next?: string[];
}

export interface DialogueOption {
  id: string;
  text: string;
  outcome?: EventOutcome;
  nextNode?: string;
}

export interface GameState {
  board: BoardTile[];
  player: Player;
  currentTurn: number;
  diceRolls: DiceRoll[];
  activeEvents: GameEvent[];
  gameHistory: GameHistoryEntry[];
  seed?: string; // For procedural generation
}

export interface GameHistoryEntry {
  turn: number;
  action: string;
  details: unknown;
  timestamp: number;
}

export interface BoardGenerationParams {
  config: BoardConfig;
  seed?: string;
  minPathLength?: number;
  maxPathLength?: number;
}
