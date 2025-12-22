/**
 * Connection Store
 * 
 * Manages OBS WebSocket connection state
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type { Source, ConnectionState } from '../types';

export const connected: Writable<boolean> = writable(false);
export const currentScene: Writable<string> = writable('');
export const sources: Writable<Source[]> = writable([]);
export const textSources: Writable<Source[]> = writable([]);

// Derived store for connection state
export const connectionState: Readable<ConnectionState> = derived(
  [connected, currentScene, sources, textSources],
  ([$connected, $scene, $sources, $textSources]) => ({
    connected: $connected,
    currentScene: $scene,
    sources: $sources,
    textSources: $textSources
  })
);

// Derived store for ready state
export const isReady: Readable<boolean> = derived(
  [connected, currentScene],
  ([$connected, $scene]) => $connected && $scene !== ''
);

