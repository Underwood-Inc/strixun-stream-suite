import { expect, test } from 'vitest';
import {
  MAPPY_ACTION_ICON_ALIASES,
  isMappyActionIconAlias,
  resolveActionIconLucideName,
} from './canon/mappyActionIconAliasCatalog.js';

test('[FR-SS-ICON-001] shortener action aliases resolve to Lucide icons', () => {
  const aliases = ['action.copy', 'action.delete', 'action.refresh', 'action.link'] as const;
  for (const alias of aliases) {
    expect(isMappyActionIconAlias(alias)).toBe(true);
    const lucide = resolveActionIconLucideName(alias);
    expect(lucide).toBe(MAPPY_ACTION_ICON_ALIASES[alias].lucide);
    expect(lucide).toBeTruthy();
  }
});