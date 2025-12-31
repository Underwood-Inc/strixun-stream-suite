/**
 * Hexagonal grid mathematics utilities
 * Uses axial coordinate system (q, r, s)
 */

import type { HexCoordinate } from '../types/index.js';

/**
 * Convert axial coordinates to pixel coordinates
 */
export function hexToPixel(hex: HexCoordinate, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
  const y = size * ((3 / 2) * hex.r);
  return { x, y };
}

/**
 * Convert pixel coordinates to hex coordinates
 */
export function pixelToHex(point: { x: number; y: number }, size: number): HexCoordinate {
  const q = ((Math.sqrt(3) / 3) * point.x - (1 / 3) * point.y) / size;
  const r = ((2 / 3) * point.y) / size;
  return hexRound({ q, r, s: -q - r });
}

/**
 * Round fractional hex coordinates to nearest hex
 */
export function hexRound(hex: { q: number; r: number; s: number }): HexCoordinate {
  let q = Math.round(hex.q);
  let r = Math.round(hex.r);
  let s = Math.round(hex.s);

  const qDiff = Math.abs(q - hex.q);
  const rDiff = Math.abs(r - hex.r);
  const sDiff = Math.abs(s - hex.s);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  } else {
    s = -q - r;
  }

  return { q, r, s };
}

/**
 * Get distance between two hex coordinates
 */
export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * Get all neighbors of a hex coordinate
 */
export function hexNeighbors(hex: HexCoordinate): HexCoordinate[] {
  const directions: HexCoordinate[] = [
    { q: 1, r: 0, s: -1 },
    { q: 1, r: -1, s: 0 },
    { q: 0, r: -1, s: 1 },
    { q: -1, r: 0, s: 1 },
    { q: -1, r: 1, s: 0 },
    { q: 0, r: 1, s: -1 },
  ];

  return directions.map(dir => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
    s: hex.s + dir.s,
  }));
}

/**
 * Get hex coordinate ID
 */
export function hexId(hex: HexCoordinate): string {
  return `${hex.q},${hex.r},${hex.s}`;
}

/**
 * Parse hex coordinate from ID
 */
export function hexFromId(id: string): HexCoordinate {
  const [q, r, s] = id.split(',').map(Number);
  return { q, r, s: s ?? -q - r };
}

/**
 * Wrap hex coordinate to board bounds
 */
export function wrapHex(
  hex: HexCoordinate,
  width: number,
  height: number
): HexCoordinate {
  // Simple wrapping - can be enhanced for more complex patterns
  let q = hex.q;
  let r = hex.r;

  // Wrap horizontally (q axis)
  while (q < 0) q += width;
  while (q >= width) q -= width;

  // Wrap vertically (r axis)
  while (r < 0) r += height;
  while (r >= height) r -= height;

  return { q, r, s: -q - r };
}

/**
 * Check if hex is within bounds
 */
export function hexInBounds(
  hex: HexCoordinate,
  width: number,
  height: number
): boolean {
  return hex.q >= 0 && hex.q < width && hex.r >= 0 && hex.r < height;
}

/**
 * Get path between two hex coordinates using A* algorithm
 */
export function hexPath(
  start: HexCoordinate,
  end: HexCoordinate,
  isValid: (hex: HexCoordinate) => boolean
): HexCoordinate[] {
  const openSet: Array<{ hex: HexCoordinate; f: number; g: number; h: number; parent?: HexCoordinate }> = [];
  const closedSet = new Set<string>();
  const cameFrom = new Map<string, HexCoordinate>();

  const endId = hexId(end);

  openSet.push({
    hex: start,
    f: hexDistance(start, end),
    g: 0,
    h: hexDistance(start, end),
  });

  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentId = hexId(current.hex);

    if (currentId === endId) {
      // Reconstruct path
      const path: HexCoordinate[] = [current.hex];
      let parent = cameFrom.get(currentId);
      while (parent) {
        path.unshift(parent);
        const parentId = hexId(parent);
        parent = cameFrom.get(parentId);
      }
      return path;
    }

    closedSet.add(currentId);

    for (const neighbor of hexNeighbors(current.hex)) {
      if (!isValid(neighbor)) continue;

      const neighborId = hexId(neighbor);
      if (closedSet.has(neighborId)) continue;

      const tentativeG = current.g + 1;
      const existing = openSet.find(n => hexId(n.hex) === neighborId);

      if (!existing) {
        const h = hexDistance(neighbor, end);
        openSet.push({
          hex: neighbor,
          f: tentativeG + h,
          g: tentativeG,
          h,
        });
        cameFrom.set(neighborId, current.hex);
      } else if (tentativeG < existing.g) {
        existing.g = tentativeG;
        existing.f = tentativeG + existing.h;
        cameFrom.set(neighborId, current.hex);
      }
    }
  }

  return []; // No path found
}
