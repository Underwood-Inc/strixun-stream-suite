/**
 * Authorization Service Migration Helpers
 * 
 * Helper functions for migrating existing customers to the Authorization Service.
 * These should be called during the migration period to ensure all customers
 * are properly provisioned with roles and permissions.
 * 
 * @module authz-migration-helpers
 */

import { createAuthzClient } from './authz-client.js';

/**
 * Ensure a customer has authorization provisioned
 * Called on login to auto-provision new or existing customers
 * 
 * This is idempotent - safe to call multiple times
 * 
 * @param customerId - Customer ID from OTP auth
 * @param email - Customer email (for super admin check)
 * @param env - Environment variables
 */
export async function ensureCustomerAuthorization(
  customerId: string,
  email: string | undefined,
  env: any
): Promise<void> {
  try {
    const authz = createAuthzClient(env);
    
    // Check if customer already exists
    const existing = await authz.getCustomerAuthorization(customerId);
    if (existing) {
      console.log('[AuthzMigration] Customer already provisioned:', customerId);
      return;
    }

    // Determine default roles based on email (for super admins)
    const defaultRoles = await determineDefaultRoles(email, env);
    
    console.log('[AuthzMigration] Provisioning customer:', customerId, 'with roles:', defaultRoles);
    
    // Provision customer with default roles
    await authz.ensureCustomer(customerId, defaultRoles);
    
    console.log('[AuthzMigration] ✓ Customer provisioned in Authorization Service:', customerId);
  } catch (error) {
    console.error('[AuthzMigration] Failed to provision customer:', customerId, error);
    // Don't throw - provisioning failure shouldn't break login
  }
}

/**
 * Determine default roles for a customer based on their email
 * 
 * Checks:
 * 1. SUPER_ADMIN_EMAILS env var → ['super-admin']
 * 2. Otherwise → ['customer'] (default)
 * 
 * @param email - Customer email (may be undefined)
 * @param env - Environment variables
 * @returns Array of role names
 */
async function determineDefaultRoles(email: string | undefined, env: any): Promise<string[]> {
  if (!email) {
    return ['customer']; // Default role for all customers
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if email is in SUPER_ADMIN_EMAILS env var
  if (env.SUPER_ADMIN_EMAILS) {
    const superAdminEmails = env.SUPER_ADMIN_EMAILS
      .split(',')
      .map((e: string) => e.trim().toLowerCase());
    
    if (superAdminEmails.includes(normalizedEmail)) {
      console.log('[AuthzMigration] Detected super admin:', email);
      return ['super-admin']; // Super admins get all permissions
    }
  }

  // Default: regular customer
  return ['customer'];
}

/**
 * Bulk migrate existing customers to Authorization Service
 * 
 * This should be run once during deployment to migrate all existing customers.
 * 
 * @param customerIds - Array of customer IDs to migrate
 * @param env - Environment variables
 * @returns Migration summary
 */
export async function bulkMigrateCustomers(
  customerIds: string[],
  getCustomerEmail: (customerId: string) => Promise<string | undefined>,
  env: any
): Promise<{
  total: number;
  provisioned: number;
  skipped: number;
  failed: number;
}> {
  console.log('[AuthzMigration] Starting bulk migration for', customerIds.length, 'customers');
  
  let provisioned = 0;
  let skipped = 0;
  let failed = 0;

  for (const customerId of customerIds) {
    try {
      // Get customer email (if available)
      const email = await getCustomerEmail(customerId);
      
      // Check if already provisioned
      const authz = createAuthzClient(env);
      const existing = await authz.getCustomerAuthorization(customerId);
      
      if (existing) {
        console.log('[AuthzMigration] Customer already provisioned, skipping:', customerId);
        skipped++;
        continue;
      }

      // Provision with default roles
      await ensureCustomerAuthorization(customerId, email, env);
      provisioned++;
      
      console.log(`[AuthzMigration] Progress: ${provisioned + skipped + failed}/${customerIds.length}`);
    } catch (error) {
      console.error('[AuthzMigration] Failed to migrate customer:', customerId, error);
      failed++;
    }
  }

  const summary = {
    total: customerIds.length,
    provisioned,
    skipped,
    failed,
  };

  console.log('[AuthzMigration] Migration complete:', summary);
  
  return summary;
}

/**
 * Get all customer IDs from OTP Auth KV namespace
 * Helper for bulk migration
 */
export async function getAllCustomerIds(otpAuthKv: KVNamespace): Promise<string[]> {
  const customerIds: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const result = await otpAuthKv.list({ prefix: 'customer_', cursor });
    
    for (const key of result.keys) {
      // Extract customerId from key format: "customer_{customerId}"
      const customerId = key.name.replace('customer_', '');
      if (customerId && customerId.startsWith('cust_')) {
        customerIds.push(customerId);
      }
    }

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return customerIds;
}
