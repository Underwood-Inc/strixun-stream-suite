/**
 * Authentication Fixtures for E2E Tests
 * 
 * Provides authenticated page contexts for testing
 * Shared across all E2E tests
 */

import { test as base, Page } from '@playwright/test';
import { authenticateUser, TEST_USERS } from './helpers';

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Authenticate as regular user
    await authenticateUser(page, TEST_USERS.regular.email);
    await use(page);
  },
  
  adminPage: async ({ page }, use) => {
    // Authenticate as admin user
    await authenticateUser(page, TEST_USERS.admin.email);
    await use(page);
  },
});

export { expect } from '@playwright/test';

