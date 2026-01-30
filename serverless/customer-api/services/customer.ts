/**
 * Customer service
 * Customer management, storage, and retrieval
 * 
 * This service uses the dedicated CUSTOMER_KV namespace
 * and the kv-entities pattern for consistent key management.
 */

import { hashEmail } from '../utils/crypto.js';
import { getEntity, putEntity, indexSetSingle, indexGetSingle } from '@strixun/kv-entities';

interface Env {
    CUSTOMER_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Subscription information
 */
export interface Subscription {
    planId: string;
    status: 'active' | 'cancelled' | 'expired' | 'pending';
    startDate: string;
    endDate: string | null;
    renewalDate?: string | null;
    cancelledAt?: string | null;
    planName?: string;
    billingCycle?: 'monthly' | 'yearly' | 'lifetime';
    [key: string]: any;
}

/**
 * Flair/badge information
 */
export interface Flair {
    flairId: string;
    name: string;
    icon?: string;
    description?: string;
    earnedAt: string;
    category?: string;
    [key: string]: any;
}

/**
 * Customer tier level
 */
export type CustomerTier = 'free' | 'basic' | 'premium' | 'enterprise';

/**
 * Customer data structure
 */
export interface CustomerData {
    customerId: string;
    email?: string;
    companyName?: string;
    plan?: string; // Legacy field - use tier instead
    tier?: CustomerTier; // Current tier level
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLogin?: string; // Synced from otp-auth-service on each successful login
    
    // Enhanced fields
    subscriptions?: Subscription[]; // Array of subscription history
    flairs?: Flair[]; // Array of earned flairs/badges
    displayName: string; // REQUIRED: Randomly generated display name (always present)
    
    // Configuration
    config?: {
        allowedOrigins?: string[];
        [key: string]: any;
    };
    features?: {
        [key: string]: any;
    };
    
    [key: string]: any;
}

/**
 * Generate customer ID
 * 
 * Creates a unique customer ID with cust_ prefix
 * using cryptographically random values.
 */
export function generateCustomerId(): string {
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return `cust_${hex}`;
}

/**
 * Get customer by ID
 * 
 * Retrieves customer data from CUSTOMER_KV using the entity pattern.
 * 
 * @param kv - The CUSTOMER_KV namespace
 * @param customerId - The customer ID to look up
 * @returns Customer data or null if not found
 */
export async function getCustomer(kv: KVNamespace, customerId: string): Promise<CustomerData | null> {
    return await getEntity<CustomerData>(kv, 'customer', 'customer', customerId);
}

/**
 * Store customer
 * 
 * Stores customer data and creates an email-to-customer index for lookup.
 * Customer accounts persist indefinitely (no TTL) to allow account recovery.
 * 
 * @param customerId - The customer ID
 * @param customerData - The customer data to store
 * @param env - Worker environment with KV binding
 * @param expirationTtl - Optional TTL for the data (defaults to indefinite)
 */
export async function storeCustomer(
    customerId: string, 
    customerData: CustomerData, 
    env: Env,
    expirationTtl?: number
): Promise<void> {
    // Store customer entity (indefinite TTL by default)
    const putOptions = expirationTtl ? { expirationTtl } : undefined;
    await putEntity(env.CUSTOMER_KV, 'customer', 'customer', customerId, customerData, putOptions);
    
    // Store email -> customerId index for lookup (also persists indefinitely)
    if (customerData.email) {
        const emailHash = await hashEmail(customerData.email.toLowerCase().trim());
        await indexSetSingle(env.CUSTOMER_KV, 'customer', 'email-to-customer', emailHash, customerId, putOptions);
    }
}

/**
 * Get customer by email
 * 
 * Looks up customer by email using the email-to-customer index.
 * 
 * @param email - The email address to look up
 * @param env - Worker environment with KV binding
 * @returns Customer data or null if not found
 */
export async function getCustomerByEmail(email: string, env: Env): Promise<CustomerData | null> {
    const emailHash = await hashEmail(email.toLowerCase().trim());
    const customerId = await indexGetSingle(env.CUSTOMER_KV, 'customer', 'email-to-customer', emailHash);
    
    if (!customerId) {
        return null;
    }
    
    return await getCustomer(env.CUSTOMER_KV, customerId);
}
