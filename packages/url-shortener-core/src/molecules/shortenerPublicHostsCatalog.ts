export interface ShortenerPublicHostRow {
  /** Stable catalog id (hostKey). */
  id: string;
  hostname: string;
  label: string;
  registrableDomain: string;
  sortOrder: number;
}

/** Production parity: five public shortener hosts. */
export const SHORTENER_PUBLIC_HOSTS_FROZEN: readonly ShortenerPublicHostRow[] = Object.freeze([
  {
    id: 'short-army',
    hostname: 'short.army',
    label: 'short.army',
    registrableDomain: 'short.army',
    sortOrder: 1,
  },
  {
    id: 's-idling',
    hostname: 's.idling.app',
    label: 's.idling.app',
    registrableDomain: 'idling.app',
    sortOrder: 2,
  },
  {
    id: 'short-idling',
    hostname: 'short.idling.app',
    label: 'short.idling.app',
    registrableDomain: 'idling.app',
    sortOrder: 3,
  },
  {
    id: 'shorten-idling',
    hostname: 'shorten.idling.app',
    label: 'shorten.idling.app',
    registrableDomain: 'idling.app',
    sortOrder: 4,
  },
  {
    id: 'sss-idling',
    hostname: 'sss.idling.app',
    label: 'sss.idling.app',
    registrableDomain: 'idling.app',
    sortOrder: 5,
  },
]);

export const UNKNOWN_PUBLIC_HOST_KEY = 'unknown' as const;

function parseOrigin(origin: string): { hostname: string } | null {
  try {
    const url = new URL(origin.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return { hostname: url.hostname };
  } catch {
    return null;
  }
}

function rowForHostname(hostname: string): ShortenerPublicHostRow | undefined {
  return SHORTENER_PUBLIC_HOSTS_FROZEN.find((r) => r.hostname === hostname);
}

/**
 * Projects catalog rows from comma-separated origins (SHORTENER_PUBLIC_HOSTS).
 * Known hostnames use frozen row metadata; unknown origins are appended with generated ids.
 */
export function projectPublicHostsFromEnv(envValue: string | undefined): ShortenerPublicHostRow[] {
  if (!envValue?.trim()) {
    return [...SHORTENER_PUBLIC_HOSTS_FROZEN];
  }
  const origins = envValue.split(',').map((s) => s.trim()).filter(Boolean);
  const rows: ShortenerPublicHostRow[] = [];
  let sort = 1;
  for (const origin of origins) {
    const parsed = parseOrigin(origin);
    if (!parsed) continue;
    const frozen = rowForHostname(parsed.hostname);
    if (frozen) {
      rows.push({ ...frozen, sortOrder: sort++ });
    } else {
      const id = parsed.hostname.replace(/\./g, '-');
      rows.push({
        id,
        hostname: parsed.hostname,
        label: parsed.hostname,
        registrableDomain: parsed.hostname,
        sortOrder: sort++,
      });
    }
  }
  return rows.length ? rows : [...SHORTENER_PUBLIC_HOSTS_FROZEN];
}

export function shortenerPublicHostsCatalog(): readonly ShortenerPublicHostRow[] {
  return SHORTENER_PUBLIC_HOSTS_FROZEN;
}