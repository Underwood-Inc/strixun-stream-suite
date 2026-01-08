/**
 * ObfuscatedText Component Type Definitions (Enhanced)
 */

import { FC } from 'react';

export type CharsetType = 'enchant' | 'glitch' | 'block' | 'binary' | 'hex';
export type ColorVariant = 'default' | 'info' | 'warning' | 'danger' | 'success';

export interface ObfuscatedTextProps {
  /** Original text (used to determine length if length prop not provided) */
  text?: string;
  /** Custom length override */
  length?: number | null;
  /** Whether to animate the scrambling */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Character set to use */
  charset?: CharsetType;
  /** Color variant */
  color?: ColorVariant;
  /** Update interval in ms */
  updateInterval?: number;
  /** Apply blur effect */
  blur?: boolean;
  /** Show actual text on hover */
  revealOnHover?: boolean;
  /** Pause animation on hover */
  pauseOnHover?: boolean;
  /** Custom aria-label (defaults to text) */
  ariaLabel?: string;
}

export const ObfuscatedText: FC<ObfuscatedTextProps>;
export default ObfuscatedText;
