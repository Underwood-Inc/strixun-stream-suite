/**
 * Initialization State Store
 * 
 * Tracks app initialization progress and provides status messages
 * for the loading screen.
 */

import { writable, derived } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export interface InitializationState {
  /** Current initialization phase */
  phase: InitPhase;
  /** Human-readable status message */
  status: string;
  /** Optional secondary status message */
  substatus: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Whether initialization is complete */
  isComplete: boolean;
  /** Error message if initialization failed */
  error: string | null;
}

export type InitPhase = 
  | 'starting'
  | 'storage'
  | 'auth'
  | 'modules'
  | 'config'
  | 'connecting'
  | 'ready'
  | 'error';

// ============================================================================
// Store
// ============================================================================

const initialState: InitializationState = {
  phase: 'starting',
  status: 'Starting...',
  substatus: '',
  progress: 0,
  isComplete: false,
  error: null
};

const { subscribe, set, update } = writable<InitializationState>(initialState);

// ============================================================================
// Actions
// ============================================================================

/**
 * Update initialization phase with status message
 */
export function setPhase(phase: InitPhase, status?: string, substatus?: string): void {
  const phaseConfig = getPhaseConfig(phase);
  update(state => ({
    ...state,
    phase,
    status: status || phaseConfig.status,
    substatus: substatus || '',
    progress: phaseConfig.progress,
    isComplete: phase === 'ready',
    error: phase === 'error' ? (status || 'Unknown error') : null
  }));
}

/**
 * Update just the substatus message
 */
export function setSubstatus(substatus: string): void {
  update(state => ({ ...state, substatus }));
}

/**
 * Mark initialization as complete
 */
export function setReady(): void {
  setPhase('ready', 'Ready');
}

/**
 * Mark initialization as failed
 */
export function setError(error: string): void {
  setPhase('error', error);
}

/**
 * Reset initialization state
 */
export function resetInitialization(): void {
  set(initialState);
}

// ============================================================================
// Phase Configuration
// ============================================================================

function getPhaseConfig(phase: InitPhase): { status: string; progress: number } {
  switch (phase) {
    case 'starting':
      return { status: 'Starting...', progress: 0 };
    case 'storage':
      return { status: 'Loading storage...', progress: 15 };
    case 'auth':
      return { status: 'Checking authentication...', progress: 30 };
    case 'modules':
      return { status: 'Initializing modules...', progress: 50 };
    case 'config':
      return { status: 'Loading configurations...', progress: 70 };
    case 'connecting':
      return { status: 'Connecting to OBS...', progress: 85 };
    case 'ready':
      return { status: 'Ready', progress: 100 };
    case 'error':
      return { status: 'Initialization failed', progress: 0 };
    default:
      return { status: 'Loading...', progress: 0 };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const initializationState = { subscribe };

// Derived stores for convenience
export const isInitializing = derived(
  initializationState,
  $state => !$state.isComplete && $state.phase !== 'error'
);

export const initializationError = derived(
  initializationState,
  $state => $state.error
);
