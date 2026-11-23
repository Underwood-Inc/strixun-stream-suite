import { describe, expect, test } from 'vitest';
import { handleGetPublicHosts } from './public-hosts.js';

const FIVE_ORIGINS =
  'https://short.army,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://sss.idling.app';

test('[FR-SS-URL-003] GET /api/public-hosts returns projected catalog', async () => {
  const request = new Request('https://s.idling.app/api/public-hosts');
  const env = { SHORTENER_PUBLIC_HOSTS: FIVE_ORIGINS, ALLOWED_ORIGINS: 'https://s.idling.app' };
  const res = await handleGetPublicHosts(request, env);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.hosts).toHaveLength(5);
  expect(body.hosts.map((h) => h.hostname)).toContain('short.army');
});