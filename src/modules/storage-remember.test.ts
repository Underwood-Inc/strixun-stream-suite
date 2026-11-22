import { describe, expect, test, beforeEach } from 'vitest';
import { storage, isObsRememberEnabled } from './storage';

describe('isObsRememberEnabled', () => {
  beforeEach(() => {
    storage.remove('obs_remember');
  });

  test('returns true for string true', () => {
    storage.setRaw('obs_remember', 'true');
    expect(isObsRememberEnabled()).toBe(true);
  });

  test('returns true for legacy boolean true in cache', () => {
    storage.set('obs_remember', true);
    expect(isObsRememberEnabled()).toBe(true);
  });

  test('returns false when unset', () => {
    expect(isObsRememberEnabled()).toBe(false);
  });
});