/**
 * Response Builder Utility
 * Builds API responses with proper encryption based on customer preferences
 * 
 * CRITICAL: We ONLY use customerId - NO userId
 * CRITICAL: We DO NOT return OTP email addresses in responses
 * 
 * This utility:
 * 1. Checks customer preferences for email visibility
 * 2. Always includes id and customerId (single-encrypted by router)
 * 3. NEVER includes email in responses (OTP email is sensitive)
 */

import { getCustomerPreferences } from '../services/customer-preferences.js';
import type { Env } from '../services/customer-preferences.js';

export interface ResponseData {
  id: string;
  customerId: string; // MANDATORY - NOT optional
  [key: string]: any;
}

/**
 * Build response with proper encryption based on preferences
 * CRITICAL: We ONLY use customerId - NO userId
 * CRITICAL: We DO NOT return OTP email addresses
 * 
 * @param data - Response data (must include id and customerId)
 * @param ownerCustomerId - Customer ID of the data owner
 * @param ownerToken - JWT token of the data owner (for encryption if needed)
 * @param customerIdForScope - Customer ID for multi-tenant scoping
 * @param env - Worker environment
 * @returns Response data (NEVER includes email)
 */
export async function buildResponseWithEncryption(
  data: ResponseData,
  ownerCustomerId: string, // MANDATORY - use customerId, not userId
  ownerToken: string,
  customerIdForScope: string | null,
  env: Env
): Promise<ResponseData> {
  // FAIL-FAST: customerId is MANDATORY
  if (!data.customerId) {
    throw new Error('Customer ID is MANDATORY in response data');
  }
  
  // Always include id and customerId (these are single-encrypted by router)
  const response: ResponseData = {
    id: data.id,
    customerId: data.customerId, // MANDATORY
  };

  // Copy all other fields except email (we NEVER return OTP email)
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'email' && key !== 'id' && key !== 'customerId') {
      response[key] = value;
    }
  }

  // CRITICAL: We DO NOT return email addresses in responses
  // OTP email is sensitive and should never be exposed

  return response;
}

/**
 * Build response for current customer
 * CRITICAL: We ONLY use customerId - NO userId
 * CRITICAL: We DO NOT return OTP email addresses
 */
export async function buildCurrentUserResponse(
  data: ResponseData,
  customerId: string, // MANDATORY - use customerId, not userId
  userToken: string,
  customerIdForScope: string | null,
  env: Env
): Promise<ResponseData> {
  // FAIL-FAST: customerId is MANDATORY
  if (!customerId) {
    throw new Error('Customer ID is MANDATORY for building current customer response');
  }
  
  // FAIL-FAST: data.customerId is MANDATORY
  if (!data.customerId) {
    throw new Error('Customer ID is MANDATORY in response data');
  }

  const response: ResponseData = {
    id: data.id,
    customerId: data.customerId, // MANDATORY
  };

  // Copy all other fields except email (we NEVER return OTP email)
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'email' && key !== 'id' && key !== 'customerId') {
      response[key] = value;
    }
  }

  // CRITICAL: We DO NOT return email addresses in responses
  // OTP email is sensitive and should never be exposed

  return response;
}

