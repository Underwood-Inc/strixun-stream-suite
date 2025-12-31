import type { RefObject } from 'react';
import type { GameState, BoardConfig, DiceConfig } from '../src/types/index.js';

export interface DiceBoardGameProps {
  containerRef?: RefObject<HTMLElement>;
  config?: BoardConfig;
  diceConfig?: DiceConfig;
  onStateChange?: (state: GameState) => void;
  onEventTriggered?: (event: unknown) => void;
  gameApiUrl?: string;
  authToken?: string;
}

export interface DiceBoardGameContainerProps extends DiceBoardGameProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}
