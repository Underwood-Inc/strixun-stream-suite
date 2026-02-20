/**
 * Access Service Migration Helpers
 * 
 * Helper functions for migrating existing customers to the Access Service.
 * These should be called during the migration period to ensure all customers
 * are properly provisioned with roles and permissions.
 * 
 * @module access-migration-helpers
 */

import { createAccessClient } from './access-client.js';

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
export async function ensureCustomerAccess(
  customerId: string,
  email: string | undefined,
  env: any
): Promise<void> {
  try {
    const access = createAccessClient(env);
    
    // Check if customer already exists
    const existing = await access.getCustomerAuthorization(customerId);
    if (existing) {
      console.log('[AccessMigration] Customer already provisioned:', customerId);
      return;
    }

    // Determine default roles based on email (for super admins)
    const defaultRoles = await determineDefaultRoles(email, env);
    
    console.log('[AccessMigration] Provisioning customer:', customerId, 'with roles:', defaultRoles);
    
    // Provision customer with default roles
    await access.ensureCustomer(customerId, defaultRoles);
    
    console.log('[AccessMigration] ✓ Customer provisioned in Access Service:', customerId);
  } catch (error) {
    console.error('[AccessMigration] ❌ CRITICAL: Failed to provision customer:', customerId);
    console.error('[AccessMigration] Error details:', error);
    console.error('[AccessMigration] Stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

/**
 * Determine default roles for a customer based on their email
 * 
 * Checks:
 * 1. Hardcoded DEFAULT_SUPER_ADMIN_EMAILS → ['super-admin', 'uploader']
 * 2. SUPER_ADMIN_EMAILS env var → ['super-admin', 'uploader']
 * 3. Otherwise → ['customer', 'uploader'] (default)
 * 
 * @param email - Customer email (may be undefined)
 * @param env - Environment variables
 * @returns Array of role names
 */
async function determineDefaultRoles(email: string | undefined, env: any): Promise<string[]> {
  // DEFAULT: ALL customers get uploader permission
  const defaultRoles = ['customer', 'uploader'];

  if (!email) {
    return defaultRoles;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // HARDCODED super admins (ALWAYS included, cannot be removed)
  // This ensures m.seaward@pm.me ALWAYS has super admin access
  const hardcodedSuperAdmins = ['m.seaward@pm.me'];
  
  // Combine hardcoded + env var super admins
  const superAdminEmails = [...hardcodedSuperAdmins];
  if (env.SUPER_ADMIN_EMAILS) {
    const envAdmins = env.SUPER_ADMIN_EMAILS
      .split(',')
      .map((e: string) => e.trim().toLowerCase());
    superAdminEmails.push(...envAdmins);
  }
  
  // Check if email is a super admin
  if (superAdminEmails.includes(normalizedEmail)) {
    console.log('[AccessMigration] Detected super admin:', email);
    // Super admins get super-admin role + uploader permission
    return ['super-admin', 'uploader'];
  }

  // Default: ALL customers get customer + uploader roles
  return defaultRoles;
}

/**
 * Bulk migrate existing customers to Access Service
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
  console.log('[AccessMigration] Starting bulk migration for', customerIds.length, 'customers');
  
  let provisioned = 0;
  let skipped = 0;
  let failed = 0;

  for (const customerId of customerIds) {
    try {
      // Get customer email (if available)
      const email = await getCustomerEmail(customerId);
      
      // Check if already provisioned
      const access = createAccessClient(env);
      const existing = await access.getCustomerAuthorization(customerId);
      
      if (existing) {
        console.log('[AccessMigration] Customer already provisioned, skipping:', customerId);
        skipped++;
        continue;
      }

      // Provision with default roles
      await ensureCustomerAccess(customerId, email, env);
      provisioned++;
      
      console.log(`[AccessMigration] Progress: ${provisioned + skipped + failed}/${customerIds.length}`);
    } catch (error) {
      console.error('[AccessMigration] Failed to migrate customer:', customerId, error);
      failed++;
    }
  }

  const summary = {
    total: customerIds.length,
    provisioned,
    skipped,
    failed,
  };

  console.log('[AccessMigration] Migration complete:', summary);
  
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
