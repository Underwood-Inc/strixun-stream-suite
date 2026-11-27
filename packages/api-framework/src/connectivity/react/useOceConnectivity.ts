import type { ConnectivityEngine, ConnectivitySnapshot } from '../types';
import { SERVER_OCE_SNAPSHOT } from '../types';

/**
 * Non-React subscribe helper. In React apps add `react` as a peer and wire:
 *
 * `useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => SERVER_OCE_SNAPSHOT)`
 */
export function getOceServerSnapshot(): ConnectivitySnapshot {
  return SERVER_OCE_SNAPSHOT;
}

export function subscribeOceSnapshot(
  engine: ConnectivityEngine,
  onStoreChange: () => void
): () => void {
  return engine.subscribe(onStoreChange);
}

export function getOceSnapshot(engine: ConnectivityEngine): ConnectivitySnapshot {
  return engine.getSnapshot();
}