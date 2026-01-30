/**
 * Customer Preferences Service
 * Manages customer privacy preferences, email visibility, and display name settings
 */

import { getEntity, putEntity } from '@strixun/kv-entities';

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

export function getDefaultPreferences(): CustomerPreferences {
  return {
    emailVisibility: 'private',
    displayName: {
      current: '',
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

export async function getCustomerPreferences(
  customerId: string,
  _customerIdForScope: string | null,
  env: Env
): Promise<CustomerPreferences> {
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for preferences lookup');
  }
  
  const stored = await getEntity<CustomerPreferences>(env.OTP_AUTH_KV, 'auth', 'preferences', customerId);
  return stored || getDefaultPreferences();
}

export async function storeCustomerPreferences(
  customerId: string,
  _customerIdForScope: string | null,
  preferences: CustomerPreferences,
  env: Env
): Promise<void> {
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for storing preferences');
  }
  
  await putEntity(env.OTP_AUTH_KV, 'auth', 'preferences', customerId, preferences, { expirationTtl: 31536000 });
}

export async function updateCustomerPreferences(
  customerId: string,
  customerIdForScope: string | null,
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

export async function addDisplayNameToHistory(
  customerId: string,
  customerIdForScope: string | null,
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

export async function canChangeDisplayName(
  customerId: string,
  customerIdForScope: string | null,
  env: Env
): Promise<{ allowed: boolean; reason?: string; nextChangeDate?: string }> {
  const preferences = await getCustomerPreferences(customerId, customerIdForScope, env);

  if (!preferences.displayName.lastChangedAt) {
    return { allowed: true };
  }

  const customerChanges = preferences.displayName.previousNames.filter(
    entry => entry.reason !== 'auto-generated'
  );
  
  if (customerChanges.length === 0) {
    preferences.displayName.lastChangedAt = null;
    await storeCustomerPreferences(customerId, customerIdForScope, preferences, env);
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

export async function updateDisplayName(
  customerId: string,
  customerIdForScope: string | null,
  newDisplayName: string,
  reason: 'customer-changed' | 'regenerated',
  env: Env
): Promise<{ success: boolean; error?: string }> {
  const canChange = await canChangeDisplayName(customerId, customerIdForScope, env);
  if (!canChange.allowed) {
    return { success: false, error: canChange.reason };
  }

  const preferences = await getCustomerPreferences(customerId, customerIdForScope, env);
  const previousName = preferences.displayName.current;

  if (previousName) {
    await addDisplayNameToHistory(customerId, customerIdForScope, previousName, reason, env);
  }

  preferences.displayName.current = newDisplayName;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeCustomerPreferences(customerId, customerIdForScope, preferences, env);

  return { success: true };
}
