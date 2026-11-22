import { describe, expect, test } from 'vitest';
import { extractRootDomainFromHostname } from './cookie-domains.js';

describe('extractRootDomainFromHostname', () => {
  test('maps shortener hosts to registrable cookie domains', () => {
    expect(extractRootDomainFromHostname('short.army')).toBe('.short.army');
    expect(extractRootDomainFromHostname('s.idling.app')).toBe('.idling.app');
    expect(extractRootDomainFromHostname('localhost')).toBe('localhost');
  });
});