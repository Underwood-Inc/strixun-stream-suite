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
    const auth = await extractAuth(request, env as Parameters<typeof extractAuth>[1]);
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

export async function callerHasPermission(
  env: FlagServiceEnv,
  auth: FlagAuth,
  permission: "flags:read" | "flags:write",
): Promise<boolean> {
  if (auth.isService || auth.isSuperAdmin) return true;

  const accessBase = env.ACCESS_SERVICE_URL ?? "https://access-api.idling.app";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth.jwtToken) headers.Authorization = `Bearer ${auth.jwtToken}`;

  try {
    const res = await fetch(`${accessBase}/access/${encodeURIComponent(auth.customerId)}/permissions`, {
      headers,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { permissions?: string[] };
    const perms = body.permissions ?? [];
    if (perms.includes("*")) return true;
    return perms.includes(permission);
  } catch (error) {
    console.error("[FeatureFlagsAuth] Access service permission check failed:", error);
    return false;
  }
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