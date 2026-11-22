/**
 * Resolve auth rate-limit budget from feature-flag D1 (when bound).
 */
import {
  resolveRateBudget,
  type RateBudget,
} from '@strixun/feature-flags';
import type { EvaluationContext, FlagState, IdentityOverride } from '@strixun/feature-flags';

export interface FlagRateEnv {
  FLAGS_DB?: D1Database;
  ENVIRONMENT?: string;
}

async function loadStates(
  db: D1Database,
  environment: string,
): Promise<Map<string, FlagState>> {
  const map = new Map<string, FlagState>();
  const { results } = await db
    .prepare('SELECT flag_id, value_json FROM flag_state WHERE environment = ?')
    .bind(environment)
    .all<{ flag_id: string; value_json: string }>();
  for (const row of results ?? []) {
    map.set(row.flag_id, {
      flagId: row.flag_id,
      environment,
      value: JSON.parse(row.value_json),
    });
  }
  return map;
}

async function loadOverrides(
  db: D1Database,
  customerId: string,
  environment: string,
): Promise<Map<string, IdentityOverride>> {
  const map = new Map<string, IdentityOverride>();
  const { results } = await db
    .prepare(
      'SELECT flag_id, value_json, expires_at FROM identity_override WHERE customer_id = ? AND environment = ?',
    )
    .bind(customerId, environment)
    .all<{ flag_id: string; value_json: string; expires_at: string | null }>();
  for (const row of results ?? []) {
    const key = `${customerId}:${row.flag_id}`;
    map.set(key, {
      flagId: row.flag_id,
      customerId,
      environment,
      value: JSON.parse(row.value_json),
      expiresAt: row.expires_at,
    });
  }
  return map;
}

export async function resolveAuthRateBudgetFromEnv(
  env: FlagRateEnv,
  customerId: string | null,
  roles: string[] = [],
): Promise<RateBudget> {
  const environment = env.ENVIRONMENT ?? 'production';
  const ctx: EvaluationContext = {
    customerId: customerId ?? undefined,
    roles,
    environment,
  };

  if (!env.FLAGS_DB || !customerId) {
    return resolveRateBudget(ctx, {
      states: new Map(),
      overrides: new Map(),
      rules: [],
    });
  }

  try {
    const [states, overrides] = await Promise.all([
      loadStates(env.FLAGS_DB, environment),
      loadOverrides(env.FLAGS_DB, customerId, environment),
    ]);
    return resolveRateBudget(ctx, { states, overrides, rules: [] });
  } catch (error) {
    console.error('[FlagRateBudget] Failed to load flags:', error);
    return resolveRateBudget(ctx, {
      states: new Map(),
      overrides: new Map(),
      rules: [],
    });
  }
}

export function unlimitedRateLimitResult(): {
  allowed: boolean;
  remaining: number;
  resetAt: string;
} {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  return {
    allowed: true,
    remaining: 999999,
    resetAt: new Date(now + oneHour).toISOString(),
  };
}