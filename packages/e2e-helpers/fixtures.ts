/**
 * Authentication Fixtures for E2E Tests
 * 
 * Provides authenticated page contexts for testing
 * Shared across all E2E tests
 */

import { test as base, Page } from '@playwright/test';
import { authenticateCustomer, TEST_CUSTOMERS } from './helpers';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Authenticate as regular customer
    await authenticateCustomer(page, TEST_CUSTOMERS.regular.email);
    await use(page);
  },
  
  adminPage: async ({ page }, use) => {
    // Authenticate as admin customer
    await authenticateCustomer(page, TEST_CUSTOMERS.admin.email);
    await use(page);
  },
});

export { expect } from '@playwright/test';

