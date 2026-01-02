/**
 * ASCIImoji Package - Main Entry Point
 * 
 * Re-exports all public APIs for convenient importing
 */

export { AsciimojiTransformer, transformText, default } from './core.js';
export type { AsciimojiConfig } from './core.js';

export {
  ASCIIMOJI_PATTERNS,
  getAsciimoji,
  hasAsciimoji,
  getAllPatterns,
  getPatternCount,
  TOTAL_PATTERN_COUNT,
} from './patterns.js';
