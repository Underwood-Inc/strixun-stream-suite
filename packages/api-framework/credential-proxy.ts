/**
 * Shared Credential Proxy Utility
 *
 * Same-origin proxy pattern for forwarding requests with HttpOnly cookie and
 * Authorization headers. Used by mods-hub, otp-auth-service, and other apps
 * to avoid cross-origin cookie issues (401 on authenticated endpoints).
 *
 * Forwards: Cookie, Authorization, Content-Type, Accept
 * Optionally forwards: Set-Cookie (for auth/login responses that set cookies)
 */

const CREDENTIAL_HEADERS = new Set(['cookie', 'authorization', 'content-type', 'accept']);

/** Registrable cookie domain for a request host (e.g. short.army → .short.army). */
export function registrableDomainForHost(hostname: string): string {
  const host = hostname.toLowerCase().split(':')[0];
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'localhost';
  }
  const parts = host.split('.');
  if (parts.length === 1) {
    return host;
  }
  return `.${parts.slice(-2).join('.')}`;
}

/** Parse Domain= from a Set-Cookie header value (case-insensitive). */
export function parseSetCookieDomain(setCookie: string): string | null {
  const match = setCookie.match(/;\s*Domain=([^;]+)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

/** True when the cookie's Domain= matches the requester's registrable domain. */
export function setCookieMatchesRequester(setCookie: string, requesterRegistrable: string): boolean {
  const cookieDomain = parseSetCookieDomain(setCookie);
  if (!cookieDomain) {
    return requesterRegistrable === 'localhost';
  }
  const normalizedCookie = cookieDomain.startsWith('.') ? cookieDomain : `.${cookieDomain}`;
  const normalizedRequester = requesterRegistrable.startsWith('.')
    ? requesterRegistrable.toLowerCase()
    : `.${requesterRegistrable.toLowerCase()}`;
  return normalizedCookie === normalizedRequester;
}

function collectUpstreamSetCookies(source: Headers): string[] {
  if (typeof source.getSetCookie === 'function') {
    const cookies = source.getSetCookie();
    if (cookies.length > 0) {
      return cookies;
    }
  }
  if (typeof (source as Headers & { getAll?: (name: string) => string[] }).getAll === 'function') {
    return (source as Headers & { getAll: (name: string) => string[] }).getAll('Set-Cookie');
  }
  const combined = source.get('Set-Cookie');
  if (!combined) {
    return [];
  }
  return combined.includes('\n')
    ? combined.split('\n').map((part) => part.trim()).filter(Boolean)
    : [combined.trim()].filter(Boolean);
}

function getRequesterHostname(request: Request): string {
  const host = request.headers.get('Host');
  if (host) {
    return host.split(':')[0].toLowerCase();
  }
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      // ignore
    }
  }
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Forward only Set-Cookie lines whose Domain= matches the browser requester's registrable domain. */
function appendSetCookiesForRequester(source: Headers, target: Headers, request: Request): number {
  const requesterRoot = registrableDomainForHost(getRequesterHostname(request));
  const upstream = collectUpstreamSetCookies(source);
  let forwarded = 0;
  for (const cookie of upstream) {
    if (setCookieMatchesRequester(cookie, requesterRoot)) {
      target.append('Set-Cookie', cookie);
      forwarded += 1;
    }
  }
  return forwarded;
}

export interface CredentialProxyOptions {
  /** Forward Set-Cookie headers from upstream (required for auth/login/refresh) */
  forwardSetCookie?: boolean;
  /** Use Worker service binding fetch (avoids same-zone 522 to auth.idling.app) */
  fetch?: typeof fetch;
}

/**
 * Proxy a request to a target URL, forwarding credential headers and CORS.
 *
 * @param request - Incoming request (from browser)
 * @param targetUrl - Full URL to forward to (e.g. https://auth.idling.app/auth/me)
 * @param options - forwardSetCookie: true for auth endpoints that set cookies
 */
export async function proxyRequestWithCredentials(
  request: Request,
  targetUrl: string,
  options: CredentialProxyOptions = {}
): Promise<Response> {
  const { forwardSetCookie = false, fetch: fetchImpl = fetch } = options;

  const headers = new Headers();
  let hasCookie = false;
  request.headers.forEach((value, key) => {
    if (CREDENTIAL_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
      if (key.toLowerCase() === 'cookie') hasCookie = true;
    }
  });

  const response = await fetchImpl(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(key, value);
    }
  });
  responseHeaders.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
  responseHeaders.set('Access-Control-Allow-Credentials', 'true');
  // Diagnostic: helps debug 401s - remove after fixing cookie flow
  responseHeaders.set('X-Proxy-Cookie-Received', hasCookie ? 'yes' : 'no');

  if (forwardSetCookie) {
    const count = appendSetCookiesForRequester(response.headers, responseHeaders, request);
    responseHeaders.set('X-Proxy-Set-Cookie-Count', String(count));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}