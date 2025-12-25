/**
 * Idle Game Overlay
 * 
 * Main export for the idle game overlay system
 */

export { default as GameOverlay } from './components/GameOverlay.svelte';
export { gameApi } from './services/game-api.js';
export * from './types/index.js';
export * from './core/loot-generator.js';
export * from './core/pixel-editor.js';
export * from './core/tooltip-system.js';

