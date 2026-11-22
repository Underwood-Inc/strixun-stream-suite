import { extractAuth } from "@strixun/api-framework";
import type { Fetcher } from "@cloudflare/workers-types";

export interface FlagServiceEnv {
  JWT_SECRET?: string;
  JWT_ISSUER?: string;
  AUTH_SERVICE?: Fetcher;
  SERVICE_API_KEY?: string;
  ACCESS_SERVICE_URL?: string;
  [key: string]: unknown;
}

export interface FlagAuth {
  customerId: string;
  jwtToken?: string;
  roles: string[];
  isService: boolean;
  isSuperAdmin: boolean;
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

/** Match url-shortener / mods-api: JWKS via service binding (avoids same-zone 522 to auth.idling.app). */
export function routeProtectionEnv(env: FlagServiceEnv): Parameters<typeof extractAuth>[1] {
  if (env.AUTH_SERVICE) {
    return {
      ...env,
      JWKS_FETCH: (url: string) => env.AUTH_SERVICE!.fetch(url),
    };
  }
  return env as Parameters<typeof extractAuth>[1];
}

export async function authenticateRequest(request: Request, env: FlagServiceEnv): Promise<FlagAuth | null> {
  const serviceKey = request.headers.get("X-Service-Key");
  if (serviceKey && env.SERVICE_API_KEY && serviceKey === env.SERVICE_API_KEY) {
    return {
      customerId: "service",
      roles: [],
      isService: true,
      isSuperAdmin: true,
    };
  }

  try {
    const auth = await extractAuth(request, routeProtectionEnv(env));
    if (!auth?.customerId) return null;
    const jwtToken = auth.jwtToken;
    const payload = jwtToken ? decodeJWTPayload(jwtToken) : null;
    const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
    const isSuperAdmin = payload?.isSuperAdmin === true || roles.includes("super-admin");
    return {
      customerId: auth.customerId,
      jwtToken,
      roles,
      isService: false,
      isSuperAdmin,
    };
  } catch (error) {
    console.error("[FeatureFlagsAuth] JWT verification failed:", error);
    return null;
  }
}

/** Feature flag catalog mutations — super-admin (or service) only. */
export function callerCanManageFlags(auth: FlagAuth): boolean {
  return auth.isService || auth.isSuperAdmin;
}

export function unauthorized(message = "Authentication required"): Response {
  return new Response(JSON.stringify({ error: "Unauthorized", message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function forbidden(message = "Insufficient permissions"): Response {
  return new Response(JSON.stringify({ error: "Forbidden", message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}