/**
 * Feature Flag API client (flags-api.idling.app / dev proxy).
 */
import { createAPIClient } from '@strixun/api-framework/client';

const getFlagsApiUrl = (): string => {
  if (typeof window === 'undefined') return '';
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FLAGS_API_URL) {
    return String(import.meta.env.VITE_FLAGS_API_URL);
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port;
    if (port === '5174' || port === '8787' || port === '5173' || port === '3000') {
      return `${window.location.origin}/flags-api`;
    }
    return 'http://localhost:8797';
  }
  return 'https://flags-api.idling.app';
};

const client = () =>
  createAPIClient({
    baseURL: getFlagsApiUrl(),
    credentials: 'include' as RequestCredentials,
    defaultHeaders: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

export type FlagSnapshot = {
  product: string;
  environment: string;
  evaluatedAt: string;
  flags: Record<string, boolean | number | null>;
};

export async function fetchFlagSnapshot(product: string, environment = 'production'): Promise<FlagSnapshot> {
  const c = client();
  return c.get<FlagSnapshot>(`/v1/snapshot?product=${encodeURIComponent(product)}&environment=${encodeURIComponent(environment)}`);
}

export async function setFlagState(
  flagId: string,
  value: boolean | number | null,
  environment = 'production',
): Promise<void> {
  const c = client();
  await c.put(`/v1/flags/${encodeURIComponent(flagId)}/state`, { value, environment });
}

export type RateBudget = {
  bypass: boolean;
  baseTries: number | null;
};

export async function evaluateAuthRateBudget(
  customerId: string,
  roles: string[] = [],
  environment = 'production',
): Promise<RateBudget> {
  const c = client();
  const response = await c.post<{ rateBudget?: RateBudget }>('/v1/evaluate', {
    product: 'auth',
    environment,
    context: { customerId, roles },
    includeRateBudget: true,
  });
  const payload =
    response && typeof response === 'object' && 'data' in response ?
      (response as { data?: { rateBudget?: RateBudget } }).data
    : (response as { rateBudget?: RateBudget });
  return payload?.rateBudget ?? { bypass: false, baseTries: null };
}