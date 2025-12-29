/**
 * Secure Fetch Utility
 * 
 * Wrapper around fetch that enforces HTTPS
 */

/**
 * Enforce HTTPS on URLs
 */
function enforceHTTPS(url: string): string {
  // Allow localhost and 127.0.0.1 for development
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }

  // Convert http:// to https://
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
    // Server-side: assume secure
    return true;
  }
  return window.location.protocol === 'https:';
}

/**
 * Secure fetch wrapper that enforces HTTPS
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const secureUrl = enforceHTTPS(url);

  if (!isHTTPS() && !secureUrl.includes('localhost') && !secureUrl.includes('127.0.0.1')) {
    console.warn(
      '[SecureFetch] Non-HTTPS connection detected. Some features may not work.'
    );
  }

  return fetch(secureUrl, options);
}

