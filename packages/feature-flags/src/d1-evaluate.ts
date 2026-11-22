import { FEATURE_FLAG_CATALOG_REVISION, rowsForProduct } from "./canon/index.js";
import type { FlagProduct } from "./types.js";
import { evaluateProductSnapshot } from "./evaluate.js";
import type { EvaluationContext, FlagState, FlagValue, IdentityOverride } from "./types.js";

export type FeatureFlagProductId = FlagProduct;

/** Minimal D1 surface — Workers bind `D1Database` at runtime. */
export interface FeatureFlagsD1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results?: T[] }>;
    };
  };
}

export interface FeatureFlagsD1Env {
  FLAGS_DB?: FeatureFlagsD1Database;
  ENVIRONMENT?: string;
}

export interface EvaluatedFeatureFlagsEnvelope {
  snapshotId: string;
  product: FeatureFlagProductId;
  environment: string;
  catalogRevision: string;
  evaluatedAt: string;
  flags: Record<string, FlagValue>;
}

async function loadStates(db: FeatureFlagsD1Database, environment: string): Promise<Map<string, FlagState>> {
  const map = new Map<string, FlagState>();
  try {
    const { results } = await db
      .prepare("SELECT flag_id, value_json FROM flag_state WHERE environment = ?")
      .bind(environment)
      .all<{ flag_id: string; value_json: string }>();
    for (const row of results ?? []) {
      map.set(row.flag_id, {
        flagId: row.flag_id,
        environment,
        value: JSON.parse(row.value_json) as FlagValue,
      });
    }
  } catch (error) {
    // Unmigrated or empty local D1 — evaluate from catalog defaults only.
    console.warn("[feature-flags] loadStates failed; using catalog defaults", error);
  }
  return map;
}

async function loadOverrides(
  db: FeatureFlagsD1Database,
  customerId: string,
  environment: string,
): Promise<Map<string, IdentityOverride>> {
  const map = new Map<string, IdentityOverride>();
  try {
    const { results } = await db
      .prepare(
        "SELECT flag_id, value_json, expires_at FROM identity_override WHERE customer_id = ? AND environment = ?",
      )
      .bind(customerId, environment)
      .all<{ flag_id: string; value_json: string; expires_at: string | null }>();
    for (const row of results ?? []) {
      const key = `${customerId}:${row.flag_id}`;
      map.set(key, {
        flagId: row.flag_id,
        customerId,
        environment,
        value: JSON.parse(row.value_json) as FlagValue,
        expiresAt: row.expires_at,
      });
    }
  } catch (error) {
    console.warn("[feature-flags] loadOverrides failed; skipping overrides", error);
  }
  return map;
}

function fingerprintFlags(flags: Record<string, FlagValue>): string {
  const keys = Object.keys(flags).sort();
  let h = 0;
  const s = keys.map((k) => `${k}=${JSON.stringify(flags[k])}`).join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export async function evaluateProductFlagsFromD1(
  env: FeatureFlagsD1Env,
  product: FeatureFlagProductId,
  context: EvaluationContext,
): Promise<EvaluatedFeatureFlagsEnvelope | null> {
  if (!env.FLAGS_DB) return null;

  const environment = context.environment ?? env.ENVIRONMENT ?? "production";
  const rows = rowsForProduct(product);
  const states = await loadStates(env.FLAGS_DB, environment);
  const overrides = context.customerId
    ? await loadOverrides(env.FLAGS_DB, context.customerId, environment)
    : new Map<string, IdentityOverride>();

  const flags = evaluateProductSnapshot(
    rows.map((r) => r.id),
    { ...context, environment },
    (flagId) => ({
      state: states.get(flagId) ?? null,
      override: overrides.get(`${context.customerId ?? ""}:${flagId}`) ?? null,
      rules: [],
    }),
  );

  const snapshotId = `${FEATURE_FLAG_CATALOG_REVISION}:${environment}:${fingerprintFlags(flags)}`;

  return {
    snapshotId,
    product,
    environment,
    catalogRevision: FEATURE_FLAG_CATALOG_REVISION,
    evaluatedAt: new Date().toISOString(),
    flags,
  };
}