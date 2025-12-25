/**
 * User Preferences Service
 * Manages user privacy preferences, email visibility, and display name settings
 */

import { getCustomerKey } from './customer.js';

export interface UserPreferences {
  emailVisibility: 'private' | 'public';
  displayName: {
    current: string;
    previousNames: Array<{
      name: string;
      changedAt: string;
      reason: 'auto-generated' | 'user-changed' | 'regenerated';
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
 * Default user preferences
 */
export function getDefaultPreferences(): UserPreferences {
  return {
    emailVisibility: 'private', // Default: email is private
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

/**
 * Get user preferences
 */
export async function getUserPreferences(
  userId: string,
  customerId: string | null,
  env: Env
): Promise<UserPreferences> {
  const preferencesKey = getCustomerKey(customerId, `user_preferences_${userId}`);
  const stored = await env.OTP_AUTH_KV.get(preferencesKey, { type: 'json' });

  if (stored) {
    return stored as UserPreferences;
  }

  // Return default preferences if not found
  return getDefaultPreferences();
}

/**
 * Store user preferences
 * Uses same TTL as user data (1 year) to ensure consistency
 */
export async function storeUserPreferences(
  userId: string,
  customerId: string | null,
  preferences: UserPreferences,
  env: Env
): Promise<void> {
  const preferencesKey = getCustomerKey(customerId, `user_preferences_${userId}`);
  // Use same TTL as user data (1 year / 31536000 seconds) for consistency
  await env.OTP_AUTH_KV.put(preferencesKey, JSON.stringify(preferences), { expirationTtl: 31536000 });
}

/**
 * Update user preferences (partial update)
 */
export async function updateUserPreferences(
  userId: string,
  customerId: string | null,
  updates: Partial<UserPreferences>,
  env: Env
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId, customerId, env);
  const updated: UserPreferences = {
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

  await storeUserPreferences(userId, customerId, updated, env);
  return updated;
}

/**
 * Add display name to history
 */
export async function addDisplayNameToHistory(
  userId: string,
  customerId: string | null,
  previousName: string,
  reason: 'auto-generated' | 'user-changed' | 'regenerated',
  env: Env
): Promise<void> {
  const preferences = await getUserPreferences(userId, customerId, env);
  
  preferences.displayName.previousNames.push({
    name: previousName,
    changedAt: new Date().toISOString(),
    reason,
  });

  preferences.displayName.changeCount += 1;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeUserPreferences(userId, customerId, preferences, env);
}

/**
 * Check if user can change display name (monthly limit)
 */
export async function canChangeDisplayName(
  userId: string,
  customerId: string | null,
  env: Env
): Promise<{ allowed: boolean; reason?: string; nextChangeDate?: string }> {
  const preferences = await getUserPreferences(userId, customerId, env);

  if (!preferences.displayName.lastChangedAt) {
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
 */
export async function updateDisplayName(
  userId: string,
  customerId: string | null,
  newDisplayName: string,
  reason: 'user-changed' | 'regenerated',
  env: Env
): Promise<{ success: boolean; error?: string }> {
  const canChange = await canChangeDisplayName(userId, customerId, env);
  if (!canChange.allowed) {
    return {
      success: false,
      error: canChange.reason,
    };
  }

  const preferences = await getUserPreferences(userId, customerId, env);
  const previousName = preferences.displayName.current;

  // Add previous name to history if it exists
  if (previousName) {
    await addDisplayNameToHistory(userId, customerId, previousName, reason, env);
  }

  // Update current display name
  preferences.displayName.current = newDisplayName;
  preferences.displayName.lastChangedAt = new Date().toISOString();

  await storeUserPreferences(userId, customerId, preferences, env);

  return { success: true };
}

