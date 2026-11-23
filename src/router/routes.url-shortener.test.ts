import { expect, test } from 'vitest';
import { routes } from './routes.js';

test('[FR-SS-URL-004] Stream Suite url-shortener route is not in testing', () => {
  const route = routes.find((r) => r.path === '/url-shortener');
  expect(route).toBeDefined();
  expect(route?.inTesting).toBe(false);
});