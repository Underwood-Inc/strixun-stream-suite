/**
 * ASCIImoji Patterns Type Definitions
 */

export declare const ASCIIMOJI_PATTERNS: Record<string, string>;

export declare function getAsciimoji(pattern: string): string | null;
export declare function hasAsciimoji(pattern: string): boolean;
export declare function getAllPatterns(): string[];
export declare function getPatternCount(): number;
