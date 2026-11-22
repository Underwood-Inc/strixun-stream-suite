import { describe, it, expect, vi } from 'vitest';
import {
  proxyRequestWithCredentials,
  registrableDomainForHost,
  setCookieMatchesRequester,
} from './credential-proxy.js';

describe('setCookie domain helpers', () => {
  it('maps hosts to registrable domains', () => {
    expect(registrableDomainForHost('short.army')).toBe('.short.army');
    expect(registrableDomainForHost('s.idling.app')).toBe('.idling.app');
    expect(registrableDomainForHost('localhost')).toBe('localhost');
  });

  it('matches Set-Cookie Domain= to requester root only', () => {
    const short =
      'auth_token=x; Domain=.short.army; Path=/; HttpOnly';
    const idling =
      'auth_token=y; Domain=.idling.app; Path=/; HttpOnly';
    expect(setCookieMatchesRequester(short, '.short.army')).toBe(true);
    expect(setCookieMatchesRequester(short, '.idling.app')).toBe(false);
    expect(setCookieMatchesRequester(idling, '.idling.app')).toBe(true);
    expect(setCookieMatchesRequester(idling, '.short.army')).toBe(false);
  });
});

describe('proxyRequestWithCredentials', () => {
  const dualCookies = () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append('Set-Cookie', 'auth_token=idling; Domain=.idling.app; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'auth_token=short; Domain=.short.army; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'refresh_token=idling; Domain=.idling.app; Path=/; HttpOnly');
    upstreamHeaders.append('Set-Cookie', 'refresh_token=short; Domain=.short.army; Path=/; HttpOnly');
    return upstreamHeaders;
  };

  it('forwards only requester-domain Set-Cookie on short.army', async () => {
    const mockFetch = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: dualCookies() })
    );

    const request = new Request('https://short.army/auth-api/auth/verify-otp', {
      method: 'POST',
      headers: {
        Host: 'short.army',
        Origin: 'https://short.army',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com', code: '000000' }),
    });

    const response = await proxyRequestWithCredentials(request, 'https://auth.idling.app/auth/verify-otp', {
      forwardSetCookie: true,
      fetch: mockFetch,
    });

    const setCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    expect(setCookies).toHaveLength(2);
    expect(setCookies.every((c) => c.includes('Domain=.short.army'))).toBe(true);
    expect(setCookies.some((c) => c.includes('Domain=.idling.app'))).toBe(false);
    expect(response.headers.get('X-Proxy-Set-Cookie-Count')).toBe('2');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://short.army');
  });

  it('forwards only requester-domain Set-Cookie on s.idling.app', async () => {
    const mockFetch = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: dualCookies() })
    );

    const request = new Request('https://s.idling.app/auth-api/auth/verify-otp', {
      method: 'POST',
      headers: {
        Host: 's.idling.app',
        Origin: 'https://s.idling.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com', code: '000000' }),
    });

    const response = await proxyRequestWithCredentials(request, 'https://auth.idling.app/auth/verify-otp', {
      forwardSetCookie: true,
      fetch: mockFetch,
    });

    const setCookies =
      typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
    expect(setCookies).toHaveLength(2);
    expect(setCookies.every((c) => c.includes('Domain=.idling.app'))).toBe(true);
    expect(setCookies.some((c) => c.includes('Domain=.short.army'))).toBe(false);
    expect(response.headers.get('X-Proxy-Set-Cookie-Count')).toBe('2');
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