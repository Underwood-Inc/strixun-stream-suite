/**
 * Game State Store
 * 
 * Manages global game state (current character, etc.)
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { gameApi } from '../services/game-api.js';
import type { GameCharacter } from '../types/index.js';

// Current character ID
export const currentCharacterId: Writable<string | null> = writable(null);

// Current character data
export const currentCharacter: Writable<GameCharacter | null> = writable(null);

// Loading state
export const isLoadingCharacter: Writable<boolean> = writable(false);

// Error state
export const characterError: Writable<string | null> = writable(null);

/**
 * Load character data
 */
export async function loadCharacter(characterId: string): Promise<void> {
  try {
    isLoadingCharacter.set(true);
    characterError.set(null);
    
    const result = await gameApi.getCharacter(characterId);
    currentCharacter.set(result.character);
    currentCharacterId.set(characterId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load character';
    characterError.set(message);
    console.error('Failed to load character:', error);
  } finally {
    isLoadingCharacter.set(false);
  }
}

/**
 * Clear character data
 */
export function clearCharacter(): void {
  currentCharacter.set(null);
  currentCharacterId.set(null);
  characterError.set(null);
}

/**
 * Derived store: has character
 */
export const hasCharacter: Readable<boolean> = derived(
  currentCharacter,
  ($character) => $character !== null
);

