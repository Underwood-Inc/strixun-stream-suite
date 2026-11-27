/**
 * Secure Fetch Utility
 *
 * Wrapper around fetch that enforces HTTPS, observed by the page OCE.
 */

import { getPageConnectivityEngine } from '../connectivity/getPageConnectivityEngine';

/**
 * Enforce HTTPS on URLs
 */
function enforceHTTPS(url: string): string {
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }

  if (url.startsWith('http://')) {
    console.warn('[SecureFetch] Converting HTTP to HTTPS:', url);
    return url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Check if we're in a secure context (HTTPS)
 */
function isHTTPS(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.location.protocol === 'https:';
}

const secureBaseFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const secureUrl = enforceHTTPS(url);

  if (
    !isHTTPS() &&
    !secureUrl.includes('localhost') &&
    !secureUrl.includes('127.0.0.1')
  ) {
    console.warn(
      '[SecureFetch] Non-HTTPS connection detected. Some features may not work.'
    );
  }

  if (secureUrl === url) {
    return fetch(input, init);
  }

  return fetch(secureUrl, init);
};

let cachedSecureFetch: typeof fetch | undefined;

function getObservedSecureFetch(): typeof fetch {
  if (!cachedSecureFetch) {
    const engine = getPageConnectivityEngine();
    cachedSecureFetch = engine.attachFetch(secureBaseFetch);
  }
  return cachedSecureFetch;
}

/**
 * Secure fetch wrapper that enforces HTTPS
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return getObservedSecureFetch()(url, options);
}

/** @internal Resets the cached wrapper (Vitest). */
export function resetSecureFetchObservationForTests(): void {
  cachedSecureFetch = undefined;
}