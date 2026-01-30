/**
 * Customer Preferences Service
 * Manages customer privacy preferences, email visibility, and display name settings
 * 
 * CRITICAL: Uses CUSTOMER_KV (not OTP_AUTH_KV)
 * CRITICAL: Uses customerId as primary identifier (not userId)
 * 
 * Uses kv-entities pattern for consistent key management.
 */

import * as v from 'valibot';
import {
  CustomerPreferencesSchema,
  DisplayNamePreferencesSchema,
  type CustomerPreferences,
  type DisplayNameChangeReason,
} from '@strixun/schemas/customer';
import { getEntity, putEntity } from '@strixun/kv-entities';

export interface Env {
  CUSTOMER_KV: KVNamespace;
  [key: string]: any;
}

/**
 * Default customer preferences
 */
export function getDefaultPreferences(): CustomerPreferences {
  return {
    emailVisibility: 'private', // Default: email is private
    displayName: {
      current: '', // Will be set when customer is created
      previousNames: [],
      lastChangedAt: null,
      changeCount: 0,
    },
  };
}

/**
 * Get customer preferences
 * 
 * Retrieves customer preferences from CUSTOMER_KV using the entity pattern.
 * Returns default preferences if not found or validation fails.
 */
export async function getCustomerPreferences(
  customerId: string,
  env: Env
): Promise<CustomerPreferences> {
  // FAIL-FAST: customerId is MANDATORY
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for preferences lookup');
  }
  
  const stored = await getEntity<CustomerPreferences>(env.CUSTOMER_KV, 'customer', 'preferences', customerId);

  if (stored) {
    // Validate with schema
    const result = v.safeParse(CustomerPreferencesSchema, stored);
    if (result.success) {
      return result.output;
    } else {
      console.error(`[Preferences] Invalid preferences data for customer ${customerId}:`, result.issues);
      // Return defaults if validation fails
      return getDefaultPreferences();
    }
  }

  // Return default preferences if not found
  return getDefaultPreferences();
}

/**
 * Store customer preferences
 * 
 * No TTL - customer preferences persist indefinitely like customer data
 */
export async function storeCustomerPreferences(
  customerId: string,
  preferences: CustomerPreferences,
  env: Env
): Promise<void> {
  // FAIL-FAST: customerId is MANDATORY
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for storing preferences');
  }
  
  // Validate preferences before storing
  const result = v.safeParse(CustomerPreferencesSchema, preferences);
  if (!result.success) {
    throw new Error(`Invalid preferences data: ${JSON.stringify(result.issues)}`);
  }
  
  // No TTL - preferences persist indefinitely like customer data
  await putEntity(env.CUSTOMER_KV, 'customer', 'preferences', customerId, result.output);
}

/**
 * Update customer preferences (partial update)
 * 
 * Merges updates with existing preferences.
 */
export async function updateCustomerPreferences(
  customerId: string,
  updates: Partial<CustomerPreferences>,
  env: Env
): Promise<CustomerPreferences> {
  const current = await getCustomerPreferences(customerId, env);
  const updated: CustomerPreferences = {
    ...current,
    ...updates,
    displayName: {
      ...current.displayName,
      ...(updates.displayName || {}),
    },
  };

  await storeCustomerPreferences(customerId, updated, env);
  return updated;
}

/**
 * Add display name to history
 * 
 * Tracks display name changes for audit purposes.
 */
export async function addDisplayNameToHistory(
  customerId: string,
  previousName: string,
  reason: DisplayNameChangeReason,
  env: Env
): Promise<void> {
  const preferences = await getCustomerPreferences(customerId, env);
  
  preferences.displayName.previousNames.push({
    name: previousName,
    changedAt: new Date().toISOString(),
    reason,
  });

  preferences.displayName.changeCount += 1;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeCustomerPreferences(customerId, preferences, env);
}

/**
 * Check if customer can change display name (monthly limit)
 * 
 * CRITICAL: Auto-generated names should NOT count toward the monthly limit.
 * If lastChangedAt is set but the only change was auto-generated, allow the change.
 */
export async function canChangeDisplayName(
  customerId: string,
  env: Env
): Promise<{ allowed: boolean; reason?: string; nextChangeDate?: string }> {
  const preferences = await getCustomerPreferences(customerId, env);

  // If lastChangedAt is null, customer can always change (new account or never changed)
  if (!preferences.displayName.lastChangedAt) {
    return { allowed: true };
  }

  // Check if the only name changes were auto-generated
  // If all previous names are 'auto-generated', this shouldn't count as a customer change
  const customerChanges = preferences.displayName.previousNames.filter(
    entry => entry.reason !== 'auto-generated'
  );
  
  // If there are no customer-initiated changes, allow the change
  // This handles the case where lastChangedAt was incorrectly set during account creation
  if (customerChanges.length === 0) {
    // Reset lastChangedAt to null since it was incorrectly set
    preferences.displayName.lastChangedAt = null;
    await storeCustomerPreferences(customerId, preferences, env);
    return { allowed: true };
  }

  const lastChanged = new Date(preferences.displayName.lastChangedAt);
  const now = new Date();
  const daysSinceLastChange = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastChange < 30) {
    const nextChangeDate = new Date(lastChanged);
    nextChangeDate.setDate(nextChangeDate.getDate() + 30);
    return {
      allowed: false,
      reason: `Display name can only be changed once per month. Last changed: ${lastChanged.toLocaleDateString()}`,
      nextChangeDate: nextChangeDate.toISOString(),
    };
  }

  return { allowed: true };
}

/**
 * Update display name with history tracking
 * 
 * Updates both customer record and preferences.
 */
export async function updateDisplayName(
  customerId: string,
  newDisplayName: string,
  reason: 'user-changed' | 'regenerated',
  env: Env
): Promise<{ success: boolean; error?: string }> {
  const canChange = await canChangeDisplayName(customerId, env);
  if (!canChange.allowed) {
    return {
      success: false,
      error: canChange.reason,
    };
  }

  const preferences = await getCustomerPreferences(customerId, env);
  const previousName = preferences.displayName.current;

  // Add previous name to history if it exists
  if (previousName) {
    await addDisplayNameToHistory(customerId, previousName, reason, env);
  }

  // Update current display name in preferences
  preferences.displayName.current = newDisplayName;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeCustomerPreferences(customerId, preferences, env);

  // Also update customer record displayName
  const { getCustomer, storeCustomer } = await import('./customer.js');
  const customer = await getCustomer(env.CUSTOMER_KV, customerId);
  if (customer) {
    customer.displayName = newDisplayName;
    customer.updatedAt = new Date().toISOString();
    await storeCustomer(customerId, customer, env);
  }

  return { success: true };
}
