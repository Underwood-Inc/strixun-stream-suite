/**
 * Customer service
 * Customer management, storage, and retrieval
 */

import { hashEmail } from '../utils/crypto.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
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
 * 
 * Enhanced with subscriptions, tiers, and flairs for comprehensive customer management
 */
export interface CustomerData {
    customerId: string;
    name?: string;
    email?: string;
    companyName?: string;
    plan?: string; // Legacy field - use tier instead
    tier?: CustomerTier; // Current tier level
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    
    // Enhanced fields
    subscriptions?: Subscription[]; // Array of subscription history
    flairs?: Flair[]; // Array of earned flairs/badges
    displayName: string; // MANDATORY - Randomly generated display name (globally unique, required for customer account)
    
    // Configuration
    config?: {
        allowedOrigins?: string[];
        [key: string]: any;
    };
    features?: {
        [key: string]: any;
    };
    
    // Allow additional fields for extensibility
    [key: string]: any;
}

/**
 * Get customer key with prefix for isolation
 * @param customerId - Customer ID (optional for backward compatibility)
 * @param key - Base key
 * @returns Prefixed key
 */
export function getCustomerKey(customerId: string | null, key: string): string {
    return customerId ? `cust_${customerId}_${key}` : key;
}

/**
 * Generate customer ID
 * @returns Customer ID
 */
export function generateCustomerId(): string {
    // Generate 12 random hex characters
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return `cust_${hex}`;
}

/**
 * Get customer by ID
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @returns Customer data or null
 */
export async function getCustomer(customerId: string, env: Env): Promise<CustomerData | null> {
    const customerKey = `customer_${customerId}`;
    const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as CustomerData | null;
    return customer;
}

/**
 * Store customer
 * @param customerId - Customer ID
 * @param customerData - Customer data
 * @param env - Worker environment
 * @param expirationTtl - Optional TTL in seconds (default: no expiration - customer accounts persist indefinitely)
 * @returns Promise that resolves when customer is stored
 */
export async function storeCustomer(
    customerId: string, 
    customerData: CustomerData, 
    env: Env,
    expirationTtl?: number
): Promise<void> {
    const customerKey = `customer_${customerId}`;
    
    // Customer accounts persist indefinitely (no TTL) to allow account recovery
    // Only set TTL if explicitly provided (for testing or special cases)
    const putOptions = expirationTtl ? { expirationTtl } : undefined;
    await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customerData), putOptions);
    
    // Store email -> customerId mapping for lookup (also persists indefinitely)
    if (customerData.email) {
        const emailHash = await hashEmail(customerData.email.toLowerCase().trim());
        const emailMappingKey = `email_to_customer_${emailHash}`;
        await env.OTP_AUTH_KV.put(emailMappingKey, customerId, putOptions);
    }
}

/**
 * Get customer by email
 * @param email - Customer email
 * @param env - Worker environment
 * @returns Customer data or null
 */
export async function getCustomerByEmail(email: string, env: Env): Promise<CustomerData | null> {
    const emailHash = await hashEmail(email.toLowerCase().trim());
    const emailMappingKey = `email_to_customer_${emailHash}`;
    const customerId = await env.OTP_AUTH_KV.get(emailMappingKey);
    
    if (!customerId) {
        return null;
    }
    
    return await getCustomer(customerId, env);
}

