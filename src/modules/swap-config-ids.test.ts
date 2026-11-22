import { describe, expect, test } from 'vitest';
import { ensureSwapConfigIds, generateSwapConfigId } from './swap-config-ids';

describe('swap-config-ids', () => {
  test('generateSwapConfigId returns swap_ prefix', () => {
    expect(generateSwapConfigId()).toMatch(/^swap_/);
  });

  test('ensureSwapConfigIds assigns ids to legacy configs', () => {
    const { configs, migrated } = ensureSwapConfigIds([
      { name: 'A', sourceA: 's1', sourceB: 's2' },
      { id: 'existing', name: 'B', sourceA: 's3', sourceB: 's4' },
    ]);
    expect(migrated).toBe(true);
    expect(configs[0].id).toMatch(/^swap_/);
    expect(configs[1].id).toBe('existing');
  });
});