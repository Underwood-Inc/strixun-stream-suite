/**
 * Piggyback feature-flag snapshots on API responses (Workers + browser merge helpers).
 */

import { extractAuth } from "./route-protection.js";
import {
  evaluateProductFlagsFromD1,
  resolveProductForRequest,
  sliceSnapshotForCaller,
  toWireEnvelope,
  type EvaluatedFeatureFlagsEnvelope,
  type FeatureFlagProductId,
  type FeatureFlagsD1Env,
  type FeatureFlagsWireEnvelope,
} from "@strixun/feature-flags";
import type { EvaluationContext, FlagValue } from "@strixun/feature-flags";

export const FEATURE_FLAGS_SNAPSHOT_HEADER = "X-Feature-Flags-Snapshot-Id";
export const FEATURE_FLAGS_REVISION_HEADER = "X-Feature-Flags-Revision";
export const FEATURE_FLAGS_PRODUCT_HEADER = "X-Feature-Flags-Product";
export const FEATURE_FLAGS_JSON_HEADER = "X-Feature-Flags";
export const FEATURE_FLAGS_BODY_KEY = "_featureFlags";

export type { EvaluatedFeatureFlagsEnvelope, FeatureFlagProductId, FeatureFlagsD1Env, FeatureFlagsWireEnvelope };

export interface AttachFeatureFlagsEnv extends FeatureFlagsD1Env {
  AUTH_SERVICE?: Fetcher;
  JWT_SECRET?: string;
  JWT_ISSUER?: string;
  SERVICE_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  [key: string]: unknown;
}

export interface AttachFeatureFlagsOptions {
  product?: FeatureFlagProductId;
  includeAnonymous?: boolean;
  skipPathPatterns?: RegExp[];
}

export interface ResolvedRequestAuth {
  customerId?: string;
  roles: string[];
  isAnonymous: boolean;
}

const envelopeCache = new Map<string, { at: number; envelope: EvaluatedFeatureFlagsEnvelope }>();
const ENVELOPE_CACHE_TTL_MS = 30_000;

function routeProtectionEnv(env: AttachFeatureFlagsEnv): Parameters<typeof extractAuth>[1] {
  if (env.AUTH_SERVICE) {
    return {
      ...env,
      JWKS_FETCH: (url: string) => env.AUTH_SERVICE!.fetch(url),
    };
  }
  return env as Parameters<typeof extractAuth>[1];
}

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildEvaluationContext(
  request: Request,
  env: AttachFeatureFlagsEnv,
  allowAnonymous: boolean,
): Promise<{ context: EvaluationContext | null; auth: ResolvedRequestAuth }> {
  const environment = env.ENVIRONMENT ?? "production";

  const serviceKey = request.headers.get("X-Service-Key");
  if (serviceKey && env.SERVICE_API_KEY && serviceKey === env.SERVICE_API_KEY) {
    return {
      context: {
        customerId: "service",
        roles: ["super-admin"],
        environment,
      },
      auth: { customerId: "service", roles: ["super-admin"], isAnonymous: false },
    };
  }

  const extracted = await extractAuth(request, routeProtectionEnv(env));
  if (!extracted?.customerId) {
    if (!allowAnonymous) {
      return { context: null, auth: { roles: [], isAnonymous: true } };
    }
    return {
      context: { roles: [], environment, customerId: undefined },
      auth: { roles: [], isAnonymous: true },
    };
  }

  const payload = extracted.jwtToken ? decodeJWTPayload(extracted.jwtToken) : null;
  const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
  if (payload?.isSuperAdmin === true && !roles.includes("super-admin")) {
    roles.push("super-admin");
  }

  return {
    context: {
      customerId: extracted.customerId,
      roles,
      environment,
    },
    auth: { customerId: extracted.customerId, roles, isAnonymous: false },
  };
}

function cacheKey(product: string, context: EvaluationContext): string {
  const cid = context.customerId ?? "anon";
  const roles = [...context.roles].sort().join(",");
  return `${product}:${context.environment}:${cid}:${roles}`;
}

export function resolveProductForRequestFromApi(
  request: Request,
  auth?: ResolvedRequestAuth | null,
  explicitProduct?: FeatureFlagProductId,
): FeatureFlagProductId {
  return resolveProductForRequest(request, auth ?? undefined, explicitProduct);
}

export async function resolveFeatureFlagsEnvelope(
  request: Request,
  env: AttachFeatureFlagsEnv,
  options: AttachFeatureFlagsOptions = {},
): Promise<FeatureFlagsWireEnvelope | null> {
  const product = resolveProductForRequestFromApi(request, null, options.product);
  const { context, auth } = await buildEvaluationContext(request, env, options.includeAnonymous !== false);
  if (!context) return null;

  const cacheId = cacheKey(product, context);
  const now = Date.now();
  const cached = envelopeCache.get(cacheId);
  let evaluated: EvaluatedFeatureFlagsEnvelope | null = null;
  if (cached && now - cached.at < ENVELOPE_CACHE_TTL_MS) {
    evaluated = cached.envelope;
  } else {
    evaluated = await evaluateProductFlagsFromD1(env, product, context);
    if (evaluated) {
      envelopeCache.set(cacheId, { at: now, envelope: evaluated });
    }
  }
  if (!evaluated) return null;

  const slicedFlags = sliceSnapshotForCaller(evaluated.flags, auth, product);
  return toWireEnvelope({
    product,
    environment: evaluated.environment,
    flags: slicedFlags,
    revision: evaluated.snapshotId,
  });
}

function shouldSkipPath(pathname: string, patterns?: RegExp[]): boolean {
  if (!patterns?.length) return false;
  return patterns.some((p) => p.test(pathname));
}

/**
 * Attach evaluated feature flags to an outgoing Response (JSON body merge + headers).
 */
export async function attachFeatureFlagsEnvelope(
  response: Response,
  flagsSlice: FeatureFlagsWireEnvelope,
): Promise<Response> {
  const headers = new Headers(response.headers);
  headers.set(FEATURE_FLAGS_REVISION_HEADER, flagsSlice.revision);
  headers.set(FEATURE_FLAGS_PRODUCT_HEADER, flagsSlice.product);

  const contentType = response.headers.get("Content-Type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("application/problem+json");

  if (isJson) {
    try {
      const text = await response.text();
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const merged = {
          ...(parsed as Record<string, unknown>),
          [FEATURE_FLAGS_BODY_KEY]: flagsSlice,
        };
        return new Response(JSON.stringify(merged), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
    } catch {
      // fall through to header-only
    }
  }

  headers.set(FEATURE_FLAGS_JSON_HEADER, JSON.stringify(flagsSlice.flags));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function attachFeatureFlagsToResponse(
  request: Request,
  response: Response,
  env: AttachFeatureFlagsEnv,
  options: AttachFeatureFlagsOptions = {},
): Promise<Response> {
  if (request.method === "OPTIONS") return response;

  const url = new URL(request.url);
  if (shouldSkipPath(url.pathname, options.skipPathPatterns)) {
    return response;
  }

  const envelope = await resolveFeatureFlagsEnvelope(request, env, options);
  if (!envelope) return response;

  return attachFeatureFlagsEnvelope(response, envelope);
}

export type FlagValueMap = Record<string, FlagValue>;

function legacyEnvelopeFromWire(wire: FeatureFlagsWireEnvelope): EvaluatedFeatureFlagsEnvelope {
  return {
    snapshotId: wire.revision,
    product: wire.product,
    environment: wire.environment,
    catalogRevision: wire.revision.split(":")[0] ?? "",
    evaluatedAt: new Date().toISOString(),
    flags: wire.flags,
  };
}

export function parseFeatureFlagsEnvelope(
  headers: Headers,
  body?: unknown,
): EvaluatedFeatureFlagsEnvelope | null {
  const revision =
    headers.get(FEATURE_FLAGS_REVISION_HEADER) ?? headers.get(FEATURE_FLAGS_SNAPSHOT_HEADER);

  // JSON body embed is readable cross-origin even when flag headers are not exposed.
  if (body && typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (record[FEATURE_FLAGS_BODY_KEY]) {
      const wire = record[FEATURE_FLAGS_BODY_KEY] as FeatureFlagsWireEnvelope;
      if (wire?.flags && typeof wire.flags === "object") {
        return legacyEnvelopeFromWire(wire);
      }
    }
  }

  if (!revision) return null;

  const headerJson = headers.get(FEATURE_FLAGS_JSON_HEADER);
  if (headerJson) {
    try {
      const flags = JSON.parse(headerJson) as FlagValueMap;
      const product = (headers.get(FEATURE_FLAGS_PRODUCT_HEADER) ?? "stream-suite") as FeatureFlagProductId;
      return {
        snapshotId: revision,
        product,
        environment: "production",
        catalogRevision: revision.split(":")[0] ?? "",
        evaluatedAt: new Date().toISOString(),
        flags,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function mergeFlagsFromResponse(body: unknown, headers?: Headers): EvaluatedFeatureFlagsEnvelope | null {
  const envelope = parseFeatureFlagsEnvelope(headers ?? new Headers(), body);
  if (!envelope) return null;

  if (typeof globalThis !== "undefined") {
    const mergeHook = (globalThis as { __strixunMergeFeatureFlags?: (envelope: EvaluatedFeatureFlagsEnvelope) => void })
      .__strixunMergeFeatureFlags;
    mergeHook?.(envelope);
  }

  return envelope;
}