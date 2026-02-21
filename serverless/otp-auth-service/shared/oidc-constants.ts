/**
 * OIDC Scopes and Claims Constants
 *
 * Single source of truth for scopes and claims used across OTP Auth, discovery,
 * JWT creation, UserInfo, and developer docs. Reuse these constants everywhere
 * to avoid duplication and drift.
 *
 * @module shared/oidc-constants
 */

// ---------------------------------------------------------------------------
// Scopes (OIDC / OAuth 2.0)
// ---------------------------------------------------------------------------

/** Standard OIDC scope: core identity (sub, iss, aud, exp, iat, etc.) */
export const SCOPE_OPENID = 'openid' as const;

/** Standard OIDC scope: profile claims (name, preferred_username) */
export const SCOPE_PROFILE = 'profile' as const;

/** Standard OIDC scope: email-related claims (e.g. email_verified; raw email never exposed) */
export const SCOPE_EMAIL = 'email' as const;

/** All scopes the provider supports. Use for discovery and validation. */
export const SCOPES_SUPPORTED: readonly string[] = [SCOPE_OPENID, SCOPE_PROFILE, SCOPE_EMAIL];

/** Default scope string granted when client does not request a specific scope. */
export const DEFAULT_SCOPE_STRING = `${SCOPE_OPENID} ${SCOPE_PROFILE}`;

/** Preset: minimal (openid only). */
export const PRESET_SCOPE_MINIMAL = SCOPE_OPENID;

/** Preset: default for most apps (openid + profile). */
export const PRESET_SCOPE_DEFAULT = DEFAULT_SCOPE_STRING;

/** Preset: include email-related claims. */
export const PRESET_SCOPE_WITH_EMAIL = `${SCOPE_OPENID} ${SCOPE_PROFILE} ${SCOPE_EMAIL}`;

/** Preset list for UI and docs. */
export const PRESET_SCOPES = [
  { value: PRESET_SCOPE_MINIMAL, label: 'Minimal (openid only)' },
  { value: PRESET_SCOPE_DEFAULT, label: 'Default (openid profile)' },
  { value: PRESET_SCOPE_WITH_EMAIL, label: 'With email (openid profile email)' },
] as const;

// ---------------------------------------------------------------------------
// Claim names (JWT and UserInfo)
// ---------------------------------------------------------------------------

/** Standard JWT claim names (RFC 7519). */
export const CLAIM_SUB = 'sub';
export const CLAIM_ISS = 'iss';
export const CLAIM_AUD = 'aud';
export const CLAIM_EXP = 'exp';
export const CLAIM_IAT = 'iat';
export const CLAIM_JTI = 'jti';

/** OIDC / OAuth claim names. */
export const CLAIM_SCOPE = 'scope';
export const CLAIM_EMAIL_VERIFIED = 'email_verified';
export const CLAIM_AT_HASH = 'at_hash';

/** Profile scope claims. */
export const CLAIM_NAME = 'name';
export const CLAIM_PREFERRED_USERNAME = 'preferred_username';

/** Strixun custom claims. */
export const CLAIM_CUSTOMER_ID = 'customerId';
export const CLAIM_CLIENT_ID = 'client_id';
export const CLAIM_CSRF = 'csrf';
export const CLAIM_IS_SUPER_ADMIN = 'isSuperAdmin';
export const CLAIM_DISPLAY_NAME = 'displayName';
export const CLAIM_KEY_ID = 'keyId';
export const CLAIM_SSO_SCOPE = 'ssoScope';

/** UserInfo /auth/me response also uses an alias. */
export const CLAIM_ID = 'id';

/** All claim names that may appear in the access token or UserInfo. */
export const CLAIMS_SUPPORTED: readonly string[] = [
  CLAIM_SUB,
  CLAIM_ISS,
  CLAIM_AUD,
  CLAIM_EXP,
  CLAIM_IAT,
  CLAIM_JTI,
  CLAIM_AT_HASH,
  CLAIM_EMAIL_VERIFIED,
  CLAIM_NAME,
  CLAIM_PREFERRED_USERNAME,
  CLAIM_CUSTOMER_ID,
  CLAIM_ID,
  CLAIM_IS_SUPER_ADMIN,
  CLAIM_CSRF,
  CLAIM_DISPLAY_NAME,
  CLAIM_KEY_ID,
  CLAIM_SSO_SCOPE,
  CLAIM_CLIENT_ID,
  CLAIM_SCOPE,
];

// ---------------------------------------------------------------------------
// Scope → Claims (for UserInfo filtering)
// ---------------------------------------------------------------------------

/** Claims included when scope includes openid (always present in our tokens). */
export const CLAIMS_FOR_OPENID: readonly string[] = [
  CLAIM_SUB,
  CLAIM_ID,
  CLAIM_CUSTOMER_ID,
  CLAIM_ISS,
  CLAIM_AUD,
  CLAIM_IS_SUPER_ADMIN,
  CLAIM_CSRF,
];

/** Additional claims when scope includes email. */
export const CLAIMS_FOR_EMAIL: readonly string[] = [CLAIM_EMAIL_VERIFIED];

/** Additional claims when scope includes profile. */
export const CLAIMS_FOR_PROFILE: readonly string[] = [CLAIM_NAME, CLAIM_PREFERRED_USERNAME, CLAIM_DISPLAY_NAME];

/** Map scope value to the set of claim names that scope unlocks (for UserInfo). */
export const CLAIMS_BY_SCOPE: Record<string, readonly string[]> = {
  [SCOPE_OPENID]: CLAIMS_FOR_OPENID,
  [SCOPE_EMAIL]: CLAIMS_FOR_EMAIL,
  [SCOPE_PROFILE]: CLAIMS_FOR_PROFILE,
};

/**
 * Returns the default scope string (openid profile).
 * Use when issuing tokens if no per-key or request scope is specified.
 */
export function getDefaultScope(): string {
  return DEFAULT_SCOPE_STRING;
}

/**
 * Validates that the requested scope string only contains supported scopes.
 * Returns a normalized scope string (supported scopes only, unique).
 */
export function normalizeRequestedScope(requested: string | undefined | null): string {
  if (!requested || typeof requested !== 'string') return DEFAULT_SCOPE_STRING;
  const requestedSet = new Set(requested.trim().split(/\s+/).filter(Boolean));
  const allowed = SCOPES_SUPPORTED.filter((s) => requestedSet.has(s));
  if (allowed.length === 0) return DEFAULT_SCOPE_STRING;
  return [...allowed].join(' ');
}

/**
 * Intersects requested scope with the key's allowed scopes.
 * If keyAllowedScopes is undefined or empty, treat as "all supported".
 */
export function resolveScopeForKey(
  requestedScope: string | undefined | null,
  keyAllowedScopes: string[] | undefined | null
): string {
  const requested = normalizeRequestedScope(requestedScope);
  if (!keyAllowedScopes || keyAllowedScopes.length === 0) return requested;
  const allowedSet = new Set(keyAllowedScopes);
  const requestedList = requested.split(/\s+/);
  const resolved = requestedList.filter((s) => allowedSet.has(s));
  if (resolved.length === 0) return DEFAULT_SCOPE_STRING;
  return resolved.join(' ');
}
