import { describe, it, expect, vi } from 'vitest';
import { proxyRequestWithCredentials } from './credential-proxy.js';

describe('proxyRequestWithCredentials', () => {
  it('appends every upstream Set-Cookie when forwardSetCookie is true', async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append('Set-Cookie', 'auth_token=idling; Domain=.idling.app; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'auth_token=short; Domain=.short.army; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'refresh_token=idling; Domain=.idling.app; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'refresh_token=short; Domain=.short.army; Path=/; HttpOnly');

    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: upstreamHeaders }));

    const request = new Request('https://short.army/auth-api/auth/verify-otp', {
      method: 'POST',
      headers: {
        Origin: 'https://short.army',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com', code: '000000' }),
    });

    const response = await proxyRequestWithCredentials(request, 'https://auth.idling.app/auth/verify-otp', {
      forwardSetCookie: true,
      fetch: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const setCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    expect(setCookies).toHaveLength(4);
    expect(setCookies.some((c) => c.includes('Domain=.short.army'))).toBe(true);
    expect(setCookies.some((c) => c.includes('Domain=.idling.app'))).toBe(true);
    expect(response.headers.get('X-Proxy-Set-Cookie-Count')).toBe('4');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://short.army');
  });

  it('does not forward Set-Cookie when forwardSetCookie is false', async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append('Set-Cookie', 'auth_token=test; HttpOnly');

    const mockFetch = vi.fn(async () => new Response('{}', { status: 200, headers: upstreamHeaders }));

    const request = new Request('https://short.army/auth-api/auth/me', {
      headers: { Origin: 'https://short.army', Cookie: 'auth_token=existing' },
    });

    const response = await proxyRequestWithCredentials(request, 'https://auth.idling.app/auth/me', {
      forwardSetCookie: false,
      fetch: mockFetch,
    });

    const setCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    expect(setCookies).toHaveLength(0);
    expect(response.headers.get('X-Proxy-Cookie-Received')).toBe('yes');
  });
});