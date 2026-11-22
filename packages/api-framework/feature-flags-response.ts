/**
 * Piggyback feature-flag snapshots on API responses (Workers + browser merge helpers).
 */

import { extractAuth } from "./route-protection.js";
import {
  evaluateProductFlagsFromD1,
  type EvaluatedFeatureFlagsEnvelope,
  type FeatureFlagProductId,
  type FeatureFlagsD1Env,
} from "@strixun/feature-flags";
import type { EvaluationContext, FlagValue } from "@strixun/feature-flags";

export const FEATURE_FLAGS_SNAPSHOT_HEADER = "X-Feature-Flags-Snapshot-Id";
export const FEATURE_FLAGS_PRODUCT_HEADER = "X-Feature-Flags-Product";
export const FEATURE_FLAGS_JSON_HEADER = "X-Feature-Flags";

export type { EvaluatedFeatureFlagsEnvelope, FeatureFlagProductId, FeatureFlagsD1Env };

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
): Promise<EvaluationContext | null> {
  const environment = env.ENVIRONMENT ?? "production";

  const serviceKey = request.headers.get("X-Service-Key");
  if (serviceKey && env.SERVICE_API_KEY && serviceKey === env.SERVICE_API_KEY) {
    return {
      customerId: "service",
      roles: ["super-admin"],
      environment,
    };
  }

  const auth = await extractAuth(request, routeProtectionEnv(env));
  if (!auth?.customerId) {
    if (!allowAnonymous) return null;
    return { roles: [], environment, customerId: undefined };
  }

  const payload = auth.jwtToken ? decodeJWTPayload(auth.jwtToken) : null;
  const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
  if (payload?.isSuperAdmin === true && !roles.includes("super-admin")) {
    roles.push("super-admin");
  }

  return {
    customerId: auth.customerId,
    roles,
    environment,
  };
}

export async function resolveFeatureFlagsEnvelope(
  request: Request,
  env: AttachFeatureFlagsEnv,
  options: AttachFeatureFlagsOptions = {},
): Promise<EvaluatedFeatureFlagsEnvelope | null> {
  const product = options.product ?? "stream-suite";
  const ctx = await buildEvaluationContext(request, env, options.includeAnonymous !== false);
  if (!ctx) return null;
  return evaluateProductFlagsFromD1(env, product, ctx);
}

function shouldSkipPath(pathname: string, patterns?: RegExp[]): boolean {
  if (!patterns?.length) return false;
  return patterns.some((p) => p.test(pathname));
}

/**
 * Attach evaluated feature flags to an outgoing Response (JSON body merge + headers).
 */
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

  const headers = new Headers(response.headers);
  headers.set(FEATURE_FLAGS_SNAPSHOT_HEADER, envelope.snapshotId);
  headers.set(FEATURE_FLAGS_PRODUCT_HEADER, envelope.product);

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
          featureFlags: envelope,
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

  headers.set(FEATURE_FLAGS_JSON_HEADER, JSON.stringify(envelope.flags));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export type FlagValueMap = Record<string, FlagValue>;

export function parseFeatureFlagsEnvelope(
  headers: Headers,
  body?: unknown,
): EvaluatedFeatureFlagsEnvelope | null {
  const snapshotId = headers.get(FEATURE_FLAGS_SNAPSHOT_HEADER);
  if (!snapshotId) return null;

  if (body && typeof body === "object" && body !== null && "featureFlags" in body) {
    const embedded = (body as { featureFlags?: EvaluatedFeatureFlagsEnvelope }).featureFlags;
    if (embedded?.flags && typeof embedded.flags === "object") {
      return embedded;
    }
  }

  const headerJson = headers.get(FEATURE_FLAGS_JSON_HEADER);
  if (headerJson) {
    try {
      const flags = JSON.parse(headerJson) as FlagValueMap;
      const product = (headers.get(FEATURE_FLAGS_PRODUCT_HEADER) ?? "stream-suite") as FeatureFlagProductId;
      return {
        snapshotId,
        product,
        environment: "production",
        catalogRevision: "",
        evaluatedAt: new Date().toISOString(),
        flags,
      };
    } catch {
      return null;
    }
  }

  return null;
}