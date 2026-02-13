/**
 * Procedural hexagonal board generator
 * Creates a board with smart wrapping and fork paths
 */

import type { BoardTile, BoardConfig, BoardGenerationParams } from '../types/index.js';
import { hexId, hexNeighbors, wrapHex, hexInBounds, hexFromId, hexDistance } from '../utils/hex-math.js';

/**
 * Seeded random number generator for deterministic generation
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * Generate a procedural hexagonal board
 */
export function generateBoard(params: BoardGenerationParams): BoardTile[] {
  const { config, seed, minPathLength = 20, maxPathLength = 50 } = params;
  const rng = new SeededRandom(seed ?? Date.now().toString());
  const tiles = new Map<string, BoardTile>();

  // Create start tile
  const startPos = { q: Math.floor(config.width / 2), r: Math.floor(config.height / 2), s: 0 };
  const startId = hexId(startPos);
  tiles.set(startId, {
    ...startPos,
    id: startId,
    type: 'start',
    connections: [],
  });

  // Generate main path with potential forks
  const path = generateMainPath(
    startPos,
    config,
    rng,
    minPathLength,
    maxPathLength
  );

  // Add path tiles to board
  for (let i = 0; i < path.length; i++) {
    const pos = path[i];
    const id = hexId(pos);
    const prevId = i > 0 ? hexId(path[i - 1]) : null;
    const nextId = i < path.length - 1 ? hexId(path[i + 1]) : null;

    if (!tiles.has(id)) {
      const connections: string[] = [];
      if (prevId) connections.push(prevId);
      if (nextId) connections.push(nextId);

      // Determine if this is a fork point
      const isFork = i > config.minForkChainLength && 
                     rng.next() < config.forkProbability &&
                     i < path.length - 5; // Don't fork near end

      tiles.set(id, {
        ...pos,
        id,
        type: determineTileType(pos, config, rng, i, path.length),
        connections,
        isFork: isFork || undefined,
      });
    } else {
      // Update existing tile connections
      const tile = tiles.get(id)!;
      if (prevId && !tile.connections.includes(prevId)) {
        tile.connections.push(prevId);
      }
      if (nextId && !tile.connections.includes(nextId)) {
        tile.connections.push(nextId);
      }
    }
  }

  // Generate fork paths
  const forkTiles = Array.from(tiles.values()).filter(t => t.isFork);
  for (const forkTile of forkTiles) {
    generateForkPath(forkTile, tiles, config, rng);
  }

  // Fill in surrounding tiles for board completeness
  fillBoardTiles(tiles, config, rng);

  // Set finish tile (last tile in main path)
  if (path.length > 0) {
    const finishId = hexId(path[path.length - 1]);
    const finishTile = tiles.get(finishId);
    if (finishTile) {
      finishTile.type = 'finish';
    }
  }

  return Array.from(tiles.values());
}

/**
 * Generate main path from start to finish
 */
function generateMainPath(
  start: { q: number; r: number; s: number },
  config: BoardConfig,
  rng: SeededRandom,
  minLength: number,
  maxLength: number
): Array<{ q: number; r: number; s: number }> {
  const path: Array<{ q: number; r: number; s: number }> = [start];
  const visited = new Set<string>([hexId(start)]);
  const targetLength = rng.nextInt(minLength, maxLength);

  let current = start;
  let attempts = 0;
  const maxAttempts = targetLength * 10;

  while (path.length < targetLength && attempts < maxAttempts) {
    attempts++;
    const neighbors = hexNeighbors(current);
    
    // Filter valid neighbors
    const validNeighbors = neighbors
      .map(n => config.wrapEdges ? wrapHex(n, config.width, config.height) : n)
      .filter(n => {
        const id = hexId(n);
        if (visited.has(id)) return false;
        if (!config.wrapEdges && !hexInBounds(n, config.width, config.height)) {
          return false;
        }
        return true;
      });

    if (validNeighbors.length === 0) {
      // Backtrack if stuck
      if (path.length > 1) {
        path.pop();
        current = path[path.length - 1];
        continue;
      }
      break;
    }

    // Prefer forward movement (away from start)
    validNeighbors.sort((a, b) => {
      const distA = hexDistance(a, start);
      const distB = hexDistance(b, start);
      // Prefer moving away, but allow some randomness
      if (Math.abs(distA - distB) < 2) {
        return rng.next() - 0.5; // Random if similar distance
      }
      return distB - distA; // Prefer further from start
    });

    // Select neighbor (weighted towards first choice)
    const selected = validNeighbors[rng.next() < 0.7 ? 0 : rng.nextInt(0, validNeighbors.length - 1)];
    const selectedId = hexId(selected);

    path.push(selected);
    visited.add(selectedId);
    current = selected;
  }

  return path;
}

/**
 * Generate fork path from a fork tile
 */
function generateForkPath(
  forkTile: BoardTile,
  tiles: Map<string, BoardTile>,
  config: BoardConfig,
  rng: SeededRandom
): void {
  const forkLength = rng.nextInt(3, 8);
  let current = { q: forkTile.q, r: forkTile.r, s: forkTile.s };
  const forkPath: Array<{ q: number; r: number; s: number }> = [];
  const visited = new Set<string>([forkTile.id]);

  // Find available direction (not the main path)
  const mainPathConnections = new Set(forkTile.connections);
  const neighbors = hexNeighbors(current);
  const availableNeighbors = neighbors
    .map(n => config.wrapEdges ? wrapHex(n, config.width, config.height) : n)
    .filter(n => {
      const id = hexId(n);
      if (visited.has(id)) return false;
      if (tiles.has(id) && mainPathConnections.has(id)) return false; // Don't go back to main path
      if (!config.wrapEdges && !hexInBounds(n, config.width, config.height)) {
        return false;
      }
      return true;
    });

  if (availableNeighbors.length === 0) return;

  // Create fork path
  for (let i = 0; i < forkLength; i++) {
    const validNeighbors = hexNeighbors(current)
      .map(n => config.wrapEdges ? wrapHex(n, config.width, config.height) : n)
      .filter(n => {
        const id = hexId(n);
        return !visited.has(id) && 
               (!config.wrapEdges ? hexInBounds(n, config.width, config.height) : true);
      });

    if (validNeighbors.length === 0) break;

    const selected = validNeighbors[rng.nextInt(0, validNeighbors.length - 1)];
    const selectedId = hexId(selected);

    forkPath.push(selected);
    visited.add(selectedId);

    // Create or update tile
    if (!tiles.has(selectedId)) {
      tiles.set(selectedId, {
        ...selected,
        id: selectedId,
        type: determineTileType(selected, config, rng, i, forkLength),
        connections: [hexId(current)],
      });
    } else {
      const tile = tiles.get(selectedId)!;
      const currentId = hexId(current);
      if (!tile.connections.includes(currentId)) {
        tile.connections.push(currentId);
      }
    }

    // Update current tile connection
    const currentId = hexId(current);
    const currentTile = tiles.get(currentId);
    if (currentTile) {
      if (!currentTile.connections.includes(selectedId)) {
        currentTile.connections.push(selectedId);
      }
      // Add fork path info
      if (!currentTile.forkPaths) {
        currentTile.forkPaths = [];
      }
      if (i === 0) {
        // First fork step - create new path
        currentTile.forkPaths.push([selectedId]);
      } else {
        // Continue existing path
        const lastPath = currentTile.forkPaths[currentTile.forkPaths.length - 1];
        if (lastPath) {
          lastPath.push(selectedId);
        }
      }
    }

    current = selected;
  }
}

/**
 * Determine tile type based on position and context
 */
function determineTileType(
  _pos: { q: number; r: number; s: number },
  _config: BoardConfig,
  rng: SeededRandom,
  index: number,
  totalLength: number
): BoardTile['type'] {
  const progress = index / totalLength;
  const roll = rng.next();

  // Early game - more normal tiles
  if (progress < 0.3) {
    if (roll < 0.7) return 'normal';
    if (roll < 0.85) return 'event';
    if (roll < 0.95) return 'treasure';
    return 'rest';
  }

  // Mid game - more variety
  if (progress < 0.7) {
    if (roll < 0.5) return 'normal';
    if (roll < 0.65) return 'event';
    if (roll < 0.75) return 'combat';
    if (roll < 0.85) return 'treasure';
    if (roll < 0.92) return 'shop';
    return 'rest';
  }

  // Late game - more challenge
  if (roll < 0.4) return 'normal';
  if (roll < 0.55) return 'combat';
  if (roll < 0.7) return 'event';
  if (roll < 0.85) return 'treasure';
  if (roll < 0.95) return 'boss';
  return 'rest';
}

/**
 * Fill in surrounding tiles to make board feel complete
 */
function fillBoardTiles(
  tiles: Map<string, BoardTile>,
  config: BoardConfig,
  rng: SeededRandom
): void {
  const existingTiles = Array.from(tiles.values());
  const toAdd = new Set<string>();

  // Add tiles adjacent to existing path tiles
  for (const tile of existingTiles) {
    const neighbors = hexNeighbors(tile);
    for (const neighbor of neighbors) {
      const n = config.wrapEdges ? wrapHex(neighbor, config.width, config.height) : neighbor;
      if (!config.wrapEdges && !hexInBounds(n, config.width, config.height)) continue;
      
      const id = hexId(n);
      if (!tiles.has(id) && rng.next() < 0.3) {
        toAdd.add(id);
      }
    }
  }

  // Create the new tiles
  for (const id of toAdd) {
    const tilePos = hexFromId(id);
    tiles.set(id, {
      ...tilePos,
      id,
      type: 'normal',
      connections: [],
    });
  }
}
