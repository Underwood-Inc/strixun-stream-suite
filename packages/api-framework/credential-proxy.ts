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

export interface CredentialProxyOptions {
  /** Forward Set-Cookie headers from upstream (required for auth/login/refresh) */
  forwardSetCookie?: boolean;
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
  const { forwardSetCookie = false } = options;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (CREDENTIAL_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const response = await fetch(targetUrl, {
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

  if (forwardSetCookie) {
    if (typeof response.headers.getSetCookie === 'function') {
      for (const cookie of response.headers.getSetCookie()) {
        responseHeaders.append('Set-Cookie', cookie);
      }
    } else {
      const setCookie = response.headers.get('Set-Cookie');
      if (setCookie) responseHeaders.set('Set-Cookie', setCookie);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
