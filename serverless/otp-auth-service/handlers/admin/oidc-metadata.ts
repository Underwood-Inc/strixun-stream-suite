/**
 * GET /admin/oidc-metadata
 * Returns OIDC scopes and claims metadata for the dashboard and test page.
 * Single source of truth from shared/oidc-constants.
 */

import { getCorsHeaders } from '../../utils/cors.js';
import {
  SCOPES_SUPPORTED,
  CLAIMS_SUPPORTED,
  CLAIMS_BY_SCOPE,
  PRESET_SCOPES,
} from '../../shared/oidc-constants.js';

interface Env {
  OTP_AUTH_KV?: KVNamespace;
  [key: string]: any;
}

export interface OidcMetadataResponse {
  scopesSupported: string[];
  claimsSupported: string[];
  claimsByScope: Record<string, string[]>;
  presetScopes: { value: string; label: string }[];
}

export async function handleGetOidcMetadata(request: Request, env: Env): Promise<Response> {
  const body: OidcMetadataResponse = {
    scopesSupported: [...SCOPES_SUPPORTED],
    claimsSupported: [...CLAIMS_SUPPORTED],
    claimsByScope: Object.fromEntries(
      Object.entries(CLAIMS_BY_SCOPE).map(([k, v]) => [k, [...v]])
    ),
    presetScopes: PRESET_SCOPES.map((p) => ({ value: p.value, label: p.label })),
  };
  return new Response(JSON.stringify(body), {
    headers: {
      ...Object.fromEntries(getCorsHeaders(env, request).entries()),
      'Content-Type': 'application/json',
    },
  });
}
