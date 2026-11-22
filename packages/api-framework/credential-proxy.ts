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

/** Forward every upstream Set-Cookie (verify-otp emits 4: auth + refresh × .idling.app + .short.army). */
function appendAllSetCookies(source: Headers, target: Headers): void {
  if (typeof source.getSetCookie === 'function') {
    const cookies = source.getSetCookie();
    for (const cookie of cookies) {
      target.append('Set-Cookie', cookie);
    }
    if (cookies.length > 0) {
      return;
    }
  }
  if (typeof (source as Headers & { getAll?: (name: string) => string[] }).getAll === 'function') {
    for (const cookie of (source as Headers & { getAll: (name: string) => string[] }).getAll('Set-Cookie')) {
      target.append('Set-Cookie', cookie);
    }
    return;
  }
  const combined = source.get('Set-Cookie');
  if (!combined) {
    return;
  }
  const parts = combined.includes('\n') ? combined.split('\n') : [combined];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      target.append('Set-Cookie', trimmed);
    }
  }
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
    appendAllSetCookies(response.headers, responseHeaders);
    const count =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie().length
        : responseHeaders.getSetCookie?.()?.length ?? 0;
    responseHeaders.set('X-Proxy-Set-Cookie-Count', String(count));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
