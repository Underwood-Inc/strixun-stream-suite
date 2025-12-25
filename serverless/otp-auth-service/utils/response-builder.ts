/**
 * Response Builder Utility
 * Builds API responses with proper encryption based on user preferences
 * 
 * This utility:
 * 1. Checks user preferences for email visibility
 * 2. Double-encrypts userId (email) if private
 * 3. Returns userId as normal if public (router will single-encrypt)
 * 4. Always includes id and customerId (single-encrypted by router)
 */

import { getUserPreferences } from '../services/user-preferences.js';
import { encryptTwoStage, generateRequestKey, isDoubleEncrypted, type TwoStageEncryptedData } from './two-stage-encryption.js';
import type { Env } from '../services/user-preferences.js';

export interface ResponseData {
  id: string;
  customerId: string | null;
  userId?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Build response with proper userId encryption based on preferences
 * 
 * @param data - Response data (must include id and customerId)
 * @param ownerUserId - User ID of the data owner (whose email/userId this is)
 * @param ownerToken - JWT token of the data owner (for Stage 1 encryption)
 * @param customerId - Customer ID for preferences lookup
 * @param env - Worker environment
 * @returns Response data with userId properly encrypted
 */
export async function buildResponseWithEncryption(
  data: ResponseData,
  ownerUserId: string,
  ownerToken: string,
  customerId: string | null,
  env: Env
): Promise<ResponseData> {
  // Always include id and customerId (these are single-encrypted by router)
  const response: ResponseData = {
    id: data.id,
    customerId: data.customerId || customerId,
  };

  // Copy all other fields except userId/email (we'll handle those separately)
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'userId' && key !== 'email' && key !== 'id' && key !== 'customerId') {
      response[key] = value;
    }
  }

  // Handle userId/email encryption
  const userId = data.userId || data.email;
  if (userId) {
    // Get user preferences
    const preferences = await getUserPreferences(ownerUserId, customerId, env);

    if (preferences.emailVisibility === 'private') {
      // Double-encrypt userId with owner's JWT + request key
      // Note: For now, we generate a default request key. In Phase 2, this will come from approved requests.
      const requestKey = generateRequestKey();
      const doubleEncrypted = await encryptTwoStage(userId, ownerToken, requestKey);
      response.userId = doubleEncrypted as any; // Store as double-encrypted object
    } else {
      // Public: return userId as normal (router will single-encrypt)
      response.userId = userId;
    }
  }

  return response;
}

/**
 * Check if userId field is double-encrypted
 */
export function isUserIdDoubleEncrypted(data: any): boolean {
  return isDoubleEncrypted(data.userId);
}

/**
 * Build response for current user (userId is their own)
 * In this case, userId is always available (user can decrypt their own data)
 */
export async function buildCurrentUserResponse(
  data: ResponseData,
  userId: string,
  userToken: string,
  customerId: string | null,
  env: Env
): Promise<ResponseData> {
  // For current user, always include userId (they can decrypt it)
  // But still check preferences to determine if it should be double-encrypted for others
  const preferences = await getUserPreferences(userId, customerId, env);

  const response: ResponseData = {
    id: data.id,
    customerId: data.customerId || customerId,
  };

  // Copy all other fields
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id' && key !== 'customerId') {
      response[key] = value;
    }
  }

  // For current user, if email is private, we still return it but double-encrypted
  // This allows the user to decrypt it, but others cannot without approval
  const userIdValue = data.userId || data.email;
  if (userIdValue) {
    if (preferences.emailVisibility === 'private') {
      const requestKey = generateRequestKey();
      const doubleEncrypted = await encryptTwoStage(userIdValue, userToken, requestKey);
      response.userId = doubleEncrypted as any;
    } else {
      response.userId = userIdValue;
    }
  }

  return response;
}

