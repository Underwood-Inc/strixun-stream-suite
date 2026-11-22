import {
  evaluateProductSnapshot,
  rowsForProduct,
  FEATURE_FLAG_CATALOG_REVISION,
  getCanonRow,
  resolveRateBudget,
} from "@strixun/feature-flags";
import type {
  EvaluationContext,
  FlagState,
  FlagValue,
  IdentityOverride,
} from "@strixun/feature-flags";
import {
  authenticateRequest,
  callerHasPermission,
  forbidden,
  unauthorized,
} from "./utils/auth.js";
import type { FlagServiceEnv } from "./utils/auth.js";

export interface Env extends FlagServiceEnv {
  FLAGS_DB: D1Database;
  FLAGS_KV?: KVNamespace;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
}

type ProductId = "stream-suite" | "auth" | "access";

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const o = origin && allowed.includes(origin) ? origin : allowed[0] ?? "";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Service-Key",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function withCors(res: Response, cors: HeadersInit): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(cors)) {
    if (value !== undefined) headers.set(key, String(value));
  }
  return new Response(res.body, { status: res.status, headers });
}

async function loadStates(db: D1Database, envName: string): Promise<Map<string, FlagState>> {
  const map = new Map<string, FlagState>();
  const { results } = await db
    .prepare("SELECT flag_id, value_json FROM flag_state WHERE environment = ?")
    .bind(envName)
    .all<{ flag_id: string; value_json: string }>();
  for (const row of results ?? []) {
    map.set(row.flag_id, {
      flagId: row.flag_id,
      environment: envName,
      value: JSON.parse(row.value_json) as FlagValue,
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
  return map;
}

async function writeAuditEvent(
  env: Env,
  entry: {
    actorCustomerId: string;
    action: string;
    flagId: string;
    oldValue: FlagValue | null;
    newValue: FlagValue;
    environment: string;
  },
): Promise<void> {
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  await env.FLAGS_DB.prepare(
    `INSERT INTO audit_event (id, at, actor_customer_id, action, flag_id, old_json, new_json, reason, origin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      at,
      entry.actorCustomerId,
      entry.action,
      entry.flagId,
      entry.oldValue !== null ? JSON.stringify(entry.oldValue) : null,
      JSON.stringify(entry.newValue),
      entry.environment,
      "feature-flag-service",
    )
    .run();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, revision: FEATURE_FLAG_CATALOG_REVISION }, 200, cors);
    }

    if (url.pathname === "/v1/evaluate" && request.method === "POST") {
      let body: {
        product?: ProductId;
        environment?: string;
        context?: EvaluationContext;
        includeRateBudget?: boolean;
      };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: "invalid json" }, 400, cors);
      }

      const product = body.product ?? "auth";
      if (product !== "stream-suite" && product !== "auth" && product !== "access") {
        return json({ error: "unknown product" }, 400, cors);
      }

      const environment = body.environment ?? env.ENVIRONMENT ?? "production";
      const context: EvaluationContext = {
        customerId: body.context?.customerId,
        roles: body.context?.roles ?? [],
        environment: body.context?.environment ?? environment,
      };

      const auth = await authenticateRequest(request, env);
      const requiresAuth = body.includeRateBudget === true || Boolean(context.customerId);
      if (requiresAuth) {
        if (!auth) return withCors(unauthorized(), cors);
        const canRead = await callerHasPermission(env, auth, "flags:read");
        if (!canRead) return withCors(forbidden("flags:read required"), cors);
      }

      const rows = rowsForProduct(product);
      const states = await loadStates(env.FLAGS_DB, environment);
      const overrides =
        context.customerId ?
          await loadOverrides(env.FLAGS_DB, context.customerId, environment)
        : new Map<string, IdentityOverride>();

      const flags = evaluateProductSnapshot(
        rows.map((r) => r.id),
        context,
        (flagId) => ({
          state: states.get(flagId) ?? null,
          override: overrides.get(`${context.customerId ?? ""}:${flagId}`) ?? null,
          rules: [],
        }),
      );

      const payload: Record<string, unknown> = {
        product,
        environment,
        evaluatedAt: new Date().toISOString(),
        flags,
      };

      if (body.includeRateBudget && context.customerId) {
        payload.rateBudget = resolveRateBudget(context, { states, overrides, rules: [] });
      }

      return json(payload, 200, cors);
    }

    if (url.pathname === "/v1/snapshot" && request.method === "GET") {
      const product = (url.searchParams.get("product") ?? "stream-suite") as ProductId;
      const environment = url.searchParams.get("environment") ?? "production";
      if (product !== "stream-suite" && product !== "auth" && product !== "access") {
        return json({ error: "unknown product" }, 400, cors);
      }
      const rows = rowsForProduct(product);
      const states = await loadStates(env.FLAGS_DB, environment);
      const ctx: EvaluationContext = {
        roles: [],
        environment,
        customerId: undefined,
      };
      const flags = evaluateProductSnapshot(
        rows.map((r) => r.id),
        ctx,
        (flagId) => ({
          state: states.has(flagId)
            ? { flagId, environment, value: states.get(flagId)!.value }
            : null,
          override: null,
          rules: [],
        }),
      );
      return json(
        {
          product,
          environment,
          evaluatedAt: new Date().toISOString(),
          flags,
        },
        200,
        cors,
      );
    }

    if (url.pathname === "/v1/flags" && request.method === "GET") {
      const product = url.searchParams.get("product");
      const rows = product
        ? rowsForProduct(product as ProductId)
        : [
            ...rowsForProduct("stream-suite"),
            ...rowsForProduct("auth"),
            ...rowsForProduct("access"),
          ];
      return json(
        {
          revision: FEATURE_FLAG_CATALOG_REVISION,
          rows: rows.map((r) => ({
            id: r.id,
            product: r.product,
            kind: r.kind,
            sensitivity: r.sensitivity,
            defaultValue: r.defaultValue,
            description: r.description,
          })),
        },
        200,
        cors,
      );
    }

    const stateMatch = url.pathname.match(/^\/v1\/flags\/([^/]+)\/state$/);
    if (stateMatch && request.method === "PUT") {
      const auth = await authenticateRequest(request, env);
      if (!auth) {
        return withCors(unauthorized(), cors);
      }
      const canWrite = await callerHasPermission(env, auth, "flags:write");
      if (!canWrite) {
        return withCors(forbidden("flags:write required"), cors);
      }

      const id = decodeURIComponent(stateMatch[1]);
      if (!getCanonRow(id)) return json({ error: "unknown flag" }, 400, cors);
      const body = (await request.json()) as { value?: FlagValue; environment?: string };
      const environment = body.environment ?? "production";
      const value = body.value;
      if (value === undefined) {
        return json({ error: "value required" }, 400, cors);
      }

      const existing = await env.FLAGS_DB.prepare(
        "SELECT value_json FROM flag_state WHERE flag_id = ? AND environment = ?",
      )
        .bind(id, environment)
        .first<{ value_json: string }>();
      const oldValue = existing?.value_json ? (JSON.parse(existing.value_json) as FlagValue) : null;

      await env.FLAGS_DB.prepare(
        `INSERT INTO flag_state (flag_id, environment, value_json, updated_at, updated_by, catalog_revision)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(flag_id, environment) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
      )
        .bind(
          id,
          environment,
          JSON.stringify(value),
          new Date().toISOString(),
          auth.customerId,
          FEATURE_FLAG_CATALOG_REVISION,
        )
        .run();

      await writeAuditEvent(env, {
        actorCustomerId: auth.customerId,
        action: "flag_state_updated",
        flagId: id,
        oldValue,
        newValue: value,
        environment,
      });

      return json({ ok: true, id, value }, 200, cors);
    }

    return json({ error: "not found" }, 404, cors);
  },
};