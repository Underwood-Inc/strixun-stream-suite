/**
 * Customer Preferences Service
 * Manages customer privacy preferences, email visibility, and display name settings
 * CRITICAL: We ONLY use customerId - NO userId
 */

import { getCustomerKey } from './customer.js';

export interface CustomerPreferences {
  emailVisibility: 'private' | 'public';
  displayName: {
    current: string;
    previousNames: Array<{
      name: string;
      changedAt: string;
      reason: 'auto-generated' | 'customer-changed' | 'regenerated';
    }>;
    lastChangedAt: string | null;
    changeCount: number;
  };
  privacy: {
    showEmail: boolean;
    showProfilePicture: boolean;
  };
}

export interface Env {
  OTP_AUTH_KV: KVNamespace;
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
    privacy: {
      showEmail: false,
      showProfilePicture: true,
    },
  };
}

/**
 * Get customer preferences
 * CRITICAL: We ONLY use customerId - NO userId
 */
export async function getCustomerPreferences(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  env: Env
): Promise<CustomerPreferences> {
  // FAIL-FAST: customerId is MANDATORY
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for preferences lookup');
  }
  
  const preferencesKey = getCustomerKey(customerIdForScope, `customer_preferences_${customerId}`);
  const stored = await env.OTP_AUTH_KV.get(preferencesKey, { type: 'json' });

  if (stored) {
    return stored as CustomerPreferences;
  }

  // Return default preferences if not found
  return getDefaultPreferences();
}

/**
 * Store customer preferences
 * Uses same TTL as customer data (1 year) to ensure consistency
 * CRITICAL: We ONLY use customerId - NO userId
 */
export async function storeCustomerPreferences(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  preferences: CustomerPreferences,
  env: Env
): Promise<void> {
  // FAIL-FAST: customerId is MANDATORY
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for storing preferences');
  }
  
  const preferencesKey = getCustomerKey(customerIdForScope, `customer_preferences_${customerId}`);
  // Use same TTL as customer data (1 year / 31536000 seconds) for consistency
  await env.OTP_AUTH_KV.put(preferencesKey, JSON.stringify(preferences), { expirationTtl: 31536000 });
}

/**
 * Update customer preferences (partial update)
 * CRITICAL: We ONLY use customerId - NO userId
 */
export async function updateCustomerPreferences(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  updates: Partial<CustomerPreferences>,
  env: Env
): Promise<CustomerPreferences> {
  const current = await getCustomerPreferences(customerId, customerIdForScope, env);
  const updated: CustomerPreferences = {
    ...current,
    ...updates,
    displayName: {
      ...current.displayName,
      ...(updates.displayName || {}),
    },
    privacy: {
      ...current.privacy,
      ...(updates.privacy || {}),
    },
  };

  await storeCustomerPreferences(customerId, customerIdForScope, updated, env);
  return updated;
}

/**
 * Add display name to history
 * CRITICAL: We ONLY use customerId - NO userId
 */
export async function addDisplayNameToHistory(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  previousName: string,
  reason: 'auto-generated' | 'customer-changed' | 'regenerated',
  env: Env
): Promise<void> {
  const preferences = await getCustomerPreferences(customerId, customerIdForScope, env);
  
  preferences.displayName.previousNames.push({
    name: previousName,
    changedAt: new Date().toISOString(),
    reason,
  });

  preferences.displayName.changeCount += 1;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeCustomerPreferences(customerId, customerIdForScope, preferences, env);
}

/**
 * Check if customer can change display name (monthly limit)
 * CRITICAL: We ONLY use customerId - NO userId
 * 
 * CRITICAL: Auto-generated names should NOT count toward the monthly limit.
 * If lastChangedAt is set but the only change was auto-generated, allow the change.
 */
export async function canChangeDisplayName(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  env: Env
): Promise<{ allowed: boolean; reason?: string; nextChangeDate?: string }> {
  const preferences = await getCustomerPreferences(customerId, customerIdForScope, env);

  // If lastChangedAt is null, customer can always change (new account or never changed)
  if (!preferences.displayName.lastChangedAt) {
    return { allowed: true };
  }

  // Check if the only name change was auto-generated
  // If all previous names are 'auto-generated', this shouldn't count as a customer change
  const customerChanges = preferences.displayName.previousNames.filter(
    entry => entry.reason !== 'auto-generated'
  );
  
  // If there are no customer-initiated changes, allow the change
  // This handles the case where lastChangedAt was incorrectly set during account creation
  if (customerChanges.length === 0) {
    // Reset lastChangedAt to null since it was incorrectly set
    preferences.displayName.lastChangedAt = null;
    await storeUserPreferences(customerId, customerIdForScope, preferences, env);
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
 * CRITICAL: We ONLY use customerId - NO userId
 */
export async function updateDisplayName(
  customerId: string, // MANDATORY - use customerId, not userId
  customerIdForScope: string | null, // For multi-tenant scoping
  newDisplayName: string,
  reason: 'customer-changed' | 'regenerated',
  env: Env
): Promise<{ success: boolean; error?: string }> {
  const canChange = await canChangeDisplayName(customerId, customerIdForScope, env);
  if (!canChange.allowed) {
    return {
      success: false,
      error: canChange.reason,
    };
  }

  const preferences = await getCustomerPreferences(customerId, customerIdForScope, env);
  const previousName = preferences.displayName.current;

  // Add previous name to history if it exists
  if (previousName) {
    await addDisplayNameToHistory(customerId, customerIdForScope, previousName, reason, env);
  }

  // Update current display name
  preferences.displayName.current = newDisplayName;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeUserPreferences(customerId, customerIdForScope, preferences, env);

  return { success: true };
}

