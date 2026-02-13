/**
 * Game State Management
 * Handles game state, player movement, and integration with game API
 */

import type {
  GameState,
  Player,
  BoardTile,
  DiceRoll,
  HexCoordinate,
  GameEvent,
  Item,
  Buff,
  Debuff,
} from '../types/index.js';
import { hexId, hexDistance } from '../utils/hex-math.js';
import { generateEvent } from './event-generator.js';

/**
 * Initialize new game state
 */
export function createGameState(
  board: BoardTile[],
  seed?: string
): GameState {
  const startTile = board.find(t => t.type === 'start');
  if (!startTile) {
    throw new Error('Board must have a start tile');
  }

  const player: Player = {
    id: 'player_1',
    position: { q: startTile.q, r: startTile.r, s: startTile.s },
    health: 100,
    maxHealth: 100,
    inventory: [],
    buffs: [],
    debuffs: [],
    stats: {
      strength: 10,
      agility: 10,
      intelligence: 10,
      luck: 10,
    },
  };

  return {
    board,
    player,
    currentTurn: 1,
    diceRolls: [],
    activeEvents: [],
    gameHistory: [],
    seed,
  };
}

/**
 * Move player based on dice roll
 */
export function movePlayer(
  state: GameState,
  roll: DiceRoll,
  targetTileId?: string
): GameState {
  const currentTile = findTileAtPosition(state.board, state.player.position);
  if (!currentTile) {
    return state;
  }

  // Find target tile
  let targetTile: BoardTile | undefined;
  
  if (targetTileId) {
    targetTile = state.board.find(t => t.id === targetTileId);
  } else {
    // Move along path
    const path = findPathFromTile(currentTile, roll.total, state.board);
    if (path.length > 0) {
      targetTile = path[path.length - 1];
    }
  }

  if (!targetTile) {
    return state;
  }

  // Update player position
  const newPlayer: Player = {
    ...state.player,
    position: { q: targetTile.q, r: targetTile.r, s: targetTile.s },
  };

  // Check for fork paths
  if (targetTile.isFork && targetTile.forkPaths && targetTile.forkPaths.length > 0) {
    // Player needs to choose path - for now, pick first path
    // In UI, this would be a choice
  }

  // Trigger tile event
  const event = triggerTileEvent(targetTile, state);

  return {
    ...state,
    player: newPlayer,
    currentTurn: state.currentTurn + 1,
    diceRolls: [...state.diceRolls, roll],
    activeEvents: event ? [...state.activeEvents, event] : state.activeEvents,
    gameHistory: [
      ...state.gameHistory,
      {
        turn: state.currentTurn,
        action: `Moved to tile ${targetTile.id}`,
        details: { roll, targetTile: targetTile.id },
        timestamp: Date.now(),
      },
    ],
  };
}

/**
 * Apply event outcome to player
 */
export function applyEventOutcome(
  state: GameState,
  event: GameEvent,
  outcomeIndex: number
): GameState {
  const outcome = event.outcomes[outcomeIndex];
  if (!outcome) return state;

  const newPlayer = { ...state.player };
  const newInventory = [...state.player.inventory];
  let newBuffs = [...state.player.buffs];
  let newDebuffs = [...state.player.debuffs];

  switch (outcome.type) {
    case 'item':
      if (outcome.value && typeof outcome.value === 'object' && 'id' in outcome.value) {
        newInventory.push(outcome.value as Item);
      }
      break;
    case 'buff':
      if (outcome.value && typeof outcome.value === 'object' && 'id' in outcome.value) {
        newBuffs.push(outcome.value as Buff);
      }
      break;
    case 'debuff':
      if (outcome.value && typeof outcome.value === 'object' && 'id' in outcome.value) {
        newDebuffs.push(outcome.value as Debuff);
      }
      break;
    case 'heal':
      if (typeof outcome.value === 'number') {
        newPlayer.health = Math.min(
          newPlayer.maxHealth,
          newPlayer.health + outcome.value
        );
      }
      break;
    case 'damage':
      if (typeof outcome.value === 'number') {
        newPlayer.health = Math.max(0, newPlayer.health - outcome.value);
      }
      break;
    case 'gold':
      // Gold would be stored separately in a real implementation
      break;
    case 'experience':
      // Experience would be stored separately in a real implementation
      break;
    case 'movement':
      // Handle movement effects
      break;
  }

  // Update buffs/debuffs duration
  newBuffs = newBuffs.map(buff => ({
    ...buff,
    duration: buff.duration - 1,
  })).filter(buff => buff.duration > 0);

  newDebuffs = newDebuffs.map(debuff => ({
    ...debuff,
    duration: debuff.duration - 1,
  })).filter(debuff => debuff.duration > 0);

  newPlayer.inventory = newInventory;
  newPlayer.buffs = newBuffs;
  newPlayer.debuffs = newDebuffs;

  return {
    ...state,
    player: newPlayer,
    gameHistory: [
      ...state.gameHistory,
      {
        turn: state.currentTurn,
        action: `Event: ${event.name}`,
        details: { event: event.id, outcome: outcomeIndex },
        timestamp: Date.now(),
      },
    ],
  };
}

/**
 * Find tile at position
 */
function findTileAtPosition(
  board: BoardTile[],
  position: HexCoordinate
): BoardTile | undefined {
  const id = hexId(position);
  return board.find(t => t.id === id);
}

/**
 * Find path from tile with given distance
 */
function findPathFromTile(
  startTile: BoardTile,
  distance: number,
  board: BoardTile[]
): BoardTile[] {
  const path: BoardTile[] = [startTile];
  let current = startTile;
  const visited = new Set<string>([startTile.id]);

  for (let i = 0; i < distance && path.length < distance + 1; i++) {
    const nextConnections = current.connections
      .map(id => board.find(t => t.id === id))
      .filter((t): t is BoardTile => t !== undefined && !visited.has(t.id));

    if (nextConnections.length === 0) break;

  // Prefer forward movement (away from start)
  nextConnections.sort((a, b) => {
      const distA = hexDistance(a, startTile);
      const distB = hexDistance(b, startTile);
      return distB - distA; // Prefer further from start
    });

    const next = nextConnections[0];
    path.push(next);
    visited.add(next.id);
    current = next;
  }

  return path;
}

/**
 * Trigger event for tile
 */
function triggerTileEvent(
  tile: BoardTile,
  state: GameState
): GameEvent | null {
  if (tile.type === 'normal') return null;

  // Generate event based on tile type
  const eventType = tileTypeToEventType(tile.type);
  const rarity = determineRarity(tile, state);
  
  const event = generateEvent(
    eventType,
    rarity,
    `${state.seed ?? ''}_${tile.id}_${state.currentTurn}`
  );

  return event;
}

/**
 * Convert tile type to event type
 */
function tileTypeToEventType(tileType: BoardTile['type']): GameEvent['type'] {
  switch (tileType) {
    case 'treasure':
      return 'treasure';
    case 'combat':
      return 'combat';
    case 'event':
      return 'random';
    case 'shop':
      return 'npc';
    case 'rest':
      return 'shrine';
    case 'boss':
      return 'combat';
    default:
      return 'random';
  }
}

/**
 * Determine event rarity based on tile and game state
 */
function determineRarity(tile: BoardTile, state: GameState): GameEvent['rarity'] {
  // Rarer tiles get rarer events
  if (tile.type === 'boss') return 'legendary';
  if (tile.type === 'treasure') {
    // Later in game = rarer
    const progress = state.currentTurn / 50;
    if (progress > 0.8) return 'epic';
    if (progress > 0.5) return 'rare';
    return 'uncommon';
  }
  if (tile.type === 'combat') {
    const progress = state.currentTurn / 50;
    if (progress > 0.7) return 'rare';
    return 'uncommon';
  }
  return 'common';
}

/**
 * Save game state to API
 */
export async function saveGameState(
  state: GameState,
  apiUrl: string,
  authToken: string
): Promise<void> {
  try {
    const response = await fetch(`${apiUrl}/game/save-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        characterId: state.player.id,
        saveData: state,
        version: '1.0.0',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save game state: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving game state:', error);
    throw error;
  }
}

/**
 * Load game state from API
 */
export async function loadGameState(
  characterId: string,
  apiUrl: string,
  authToken: string
): Promise<GameState | null> {
  try {
    const response = await fetch(`${apiUrl}/game/save-state?characterId=${characterId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to load game state: ${response.statusText}`);
    }

    const data = await response.json() as { saveState?: { saveData?: GameState } };
    return data.saveState?.saveData ?? null;
  } catch (error) {
    console.error('Error loading game state:', error);
    return null;
  }
}
