import { render, screen } from '@testing-library/svelte/svelte5';
import { test, expect } from 'vitest';
import Fixture from './DataTable.minimal.fixture.svelte';

test('[FR-SS-URL-009] DataTable stack: createTable + FlexRender renders under Svelte 5', () => {
  render(Fixture);
  expect(screen.getByText('Row Alpha')).toBeInTheDocument();
});