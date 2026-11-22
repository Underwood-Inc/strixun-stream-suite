import { FEATURE_FLAG_CANON_ROWS } from '@strixun/feature-flags';
import { createAPIClient } from '@strixun/api-framework/client';
import { refreshAuth } from '@strixun/auth-store/core/api';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import '@strixun/otp-login/dist/react/otp-login.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getFlagsAdminAuthApiUrl, useAuthStore } from './stores/auth';

function flagsBaseUrl(): string {
  if (import.meta.env.VITE_FLAGS_API_URL) return String(import.meta.env.VITE_FLAGS_API_URL);
  // Same-origin Pages proxy forwards auth_token (cross-origin flags-api.idling.app returns 401 on PUT).
  return '/flags-api';
}

function isFlagsForbiddenError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('403') || /flags:read|flags:write/i.test(msg);
}

export default function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [product, setProduct] = useState<'stream-suite' | 'auth' | 'access'>('stream-suite');
  const [flags, setFlags] = useState<Record<string, boolean | number | null>>({});
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      createAPIClient({
        baseURL: flagsBaseUrl(),
        credentials: 'include',
        defaultHeaders: { 'Content-Type': 'application/json' },
        auth: {
          onTokenExpired: async () => {
            const ok = await refreshAuth();
            if (!ok) {
              await useAuthStore.getState().logout();
            }
          },
        },
      }),
    [],
  );

  useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch {
        // User may not be logged in — HttpOnly cookie SSO is checked via /auth/me
      } finally {
        setAuthLoading(false);
      }
    };
    init();
  }, [checkAuth]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const snap = await client.get<{ flags: Record<string, boolean | number | null> }>(
        `/v1/snapshot?product=${product}`,
      );
      setFlags(snap.data.flags ?? {});
    } catch (e) {
      if (isFlagsForbiddenError(e)) {
        setError('Signed in, but your account lacks flags:read. Ask an admin to grant access.');
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [client, product]);

  useEffect(() => {
    if (isAuthenticated) load();
  }, [isAuthenticated, load]);

  const handleLoginSuccess = async (_data: LoginSuccessData) => {
    setLoginError(null);
    try {
      const ok = await checkAuth();
      if (!ok) {
        setLoginError('Session validation failed. Please try again.');
      }
    } catch {
      setLoginError('Session validation error. Please try again.');
    }
  };

  const rows = FEATURE_FLAG_CANON_ROWS.filter((r) => r.product === product);

  if (authLoading) {
    return (
      <main className="flags-admin-app" style={{ padding: '2rem' }}>
        <p>Checking session…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        {loginError && <p style={{ color: '#f88', padding: '1rem' }}>{loginError}</p>}
        <OtpLogin
          apiUrl={getFlagsAdminAuthApiUrl()}
          onSuccess={handleLoginSuccess}
          title="Idling Flags"
          subtitle="Enter your email to receive a verification code"
        />
      </>
    );
  }

  return (
    <main className="flags-admin-app">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Idling Flags</h1>
        <select value={product} onChange={(e) => setProduct(e.target.value as typeof product)}>
          <option value="stream-suite">stream-suite</option>
          <option value="auth">auth</option>
          <option value="access">access</option>
        </select>
      </header>
      {error && <p style={{ color: '#f88' }}>{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Flag</th>
            <th>Default</th>
            <th>Effective</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <code>{row.id}</code>
                <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>{row.description}</div>
              </td>
              <td>{String(row.defaultValue)}</td>
              <td>{String(flags[row.id] ?? row.defaultValue)}</td>
              <td>
                {row.kind === 'boolean' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const current = flags[row.id];
                      const next = !(current === true);
                      try {
                        await client.put(`/v1/flags/${encodeURIComponent(row.id)}/state`, {
                          value: next,
                          environment: 'production',
                        });
                        setFlags((prev) => ({ ...prev, [row.id]: next }));
                      } catch (e) {
                        if (isFlagsForbiddenError(e)) {
                          setError('Signed in, but your account lacks flags:write for this action.');
                        } else {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }
                    }}
                  >
                    Toggle
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}