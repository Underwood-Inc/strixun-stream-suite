/**
 * Semantic action aliases → Mappy slug → Lucide export name.
 * Slugs align with apps/mappy/src/plugs/icons/mappyIconSlugMap.ts where noted.
 */
export const MAPPY_ACTION_ICON_ALIASES = Object.freeze({
  'action.copy': { slug: 'clipboard_copy', lucide: 'ClipboardCopy' },
  'action.delete': { slug: 'trash', lucide: 'Trash2' },
  'action.refresh': { slug: 'refresh', lucide: 'RefreshCw' },
  'action.link': { slug: 'link', lucide: 'Link' },
} as const);

export type MappyActionIconAlias = keyof typeof MAPPY_ACTION_ICON_ALIASES;

export function resolveActionIconLucideName(alias: string): string | undefined {
  const row = MAPPY_ACTION_ICON_ALIASES[alias as MappyActionIconAlias];
  return row?.lucide;
}

export function isMappyActionIconAlias(alias: string): alias is MappyActionIconAlias {
  return Object.prototype.hasOwnProperty.call(MAPPY_ACTION_ICON_ALIASES, alias);
}