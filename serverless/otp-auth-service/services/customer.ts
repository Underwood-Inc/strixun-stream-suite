/**
 * Customer service
 * Customer management, storage, and retrieval
 */

import { hashEmail } from '../utils/crypto.js';
import { getEntity, putEntity, indexSetSingle, indexGetSingle } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

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

export interface Flair {
    flairId: string;
    name: string;
    icon?: string;
    description?: string;
    earnedAt: string;
    category?: string;
    [key: string]: any;
}

export type CustomerTier = 'free' | 'basic' | 'premium' | 'enterprise';

export interface CustomerData {
    customerId: string;
    name?: string;
    email?: string;
    companyName?: string;
    plan?: string;
    tier?: CustomerTier;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    subscriptions?: Subscription[];
    flairs?: Flair[];
    displayName: string;
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
 */
export async function getCustomer(customerId: string, env: Env): Promise<CustomerData | null> {
    return await getEntity<CustomerData>(env.OTP_AUTH_KV, 'auth', 'customer', customerId);
}

/**
 * Store customer
 */
export async function storeCustomer(
    customerId: string, 
    customerData: CustomerData, 
    env: Env,
    expirationTtl?: number
): Promise<void> {
    await putEntity(env.OTP_AUTH_KV, 'auth', 'customer', customerId, customerData, 
        expirationTtl ? { expirationTtl } : undefined);
    
    if (customerData.email) {
        const emailHash = await hashEmail(customerData.email.toLowerCase().trim());
        await indexSetSingle(env.OTP_AUTH_KV, 'auth', 'email-to-customer', emailHash, customerId,
            expirationTtl ? { expirationTtl } : undefined);
    }
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string, env: Env): Promise<CustomerData | null> {
    const emailHash = await hashEmail(email.toLowerCase().trim());
    const customerId = await indexGetSingle(env.OTP_AUTH_KV, 'auth', 'email-to-customer', emailHash);
    
    if (!customerId) {
        return null;
    }
    
    return await getCustomer(customerId, env);
}
