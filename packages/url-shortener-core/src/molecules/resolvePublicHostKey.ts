import type { ShortenerPublicHostRow } from './shortenerPublicHostsCatalog.js';
import { UNKNOWN_PUBLIC_HOST_KEY } from './shortenerPublicHostsCatalog.js';

export function resolvePublicHostKey(
  hostname: string,
  catalog: readonly ShortenerPublicHostRow[],
): string {
  const normalized = hostname.trim().toLowerCase();
  const row = catalog.find((r) => r.hostname.toLowerCase() === normalized);
  return row?.id ?? UNKNOWN_PUBLIC_HOST_KEY;
}