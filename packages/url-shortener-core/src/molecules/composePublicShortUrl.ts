import type { ShortenerPublicHostRow } from './shortenerPublicHostsCatalog.js';

export function composePublicShortUrl(
  hostRow: Pick<ShortenerPublicHostRow, 'hostname'>,
  shortCode: string,
  protocol: 'https' | 'http' = 'https',
): string {
  const code = shortCode.replace(/^\//, '');
  return `${protocol}://${hostRow.hostname}/${code}`;
}