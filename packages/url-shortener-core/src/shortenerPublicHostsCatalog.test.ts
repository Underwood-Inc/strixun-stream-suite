import { describe, expect, test } from 'vitest';
import {
  SHORTENER_PUBLIC_HOSTS_FROZEN,
  projectPublicHostsFromEnv,
} from './molecules/shortenerPublicHostsCatalog.js';
import { composePublicShortUrl } from './molecules/composePublicShortUrl.js';
import { resolvePublicHostKey } from './molecules/resolvePublicHostKey.js';

test('[FR-SS-URL-001] composePublicShortUrl for all five frozen catalog hosts', () => {
  for (const row of SHORTENER_PUBLIC_HOSTS_FROZEN) {
    expect(composePublicShortUrl(row, 'abc123')).toBe(`https://${row.hostname}/abc123`);
  }
});

test('[FR-SS-URL-003] projectPublicHostsFromEnv matches frozen ids when env lists five origins', () => {
  const env =
    'https://short.army,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://sss.idling.app';
  const projected = projectPublicHostsFromEnv(env);
  expect(projected.map((r) => r.id)).toEqual(SHORTENER_PUBLIC_HOSTS_FROZEN.map((r) => r.id));
  expect(projected.map((r) => r.hostname)).toEqual(SHORTENER_PUBLIC_HOSTS_FROZEN.map((r) => r.hostname));
});

test('[FR-SS-URL-003] sixth host in env appears without code changes outside projection', () => {
  const env =
    'https://short.army,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://sss.idling.app,https://go.idling.app';
  const projected = projectPublicHostsFromEnv(env);
  expect(projected.some((r) => r.hostname === 'go.idling.app')).toBe(true);
  expect(resolvePublicHostKey('go.idling.app', projected)).toBe('go-idling-app');
});

describe('resolvePublicHostKey', () => {
  test('unknown hostname maps to unknown', () => {
    expect(resolvePublicHostKey('evil.example', SHORTENER_PUBLIC_HOSTS_FROZEN)).toBe('unknown');
  });
});