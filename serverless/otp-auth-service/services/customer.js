/**
 * Customer service
 * Customer management, storage, and retrieval
 */

import { generateApiKey, hashApiKey } from '../utils/crypto.js';

/**
 * Get customer key with prefix for isolation
 * @param {string} customerId - Customer ID (optional for backward compatibility)
 * @param {string} key - Base key
 * @returns {string} Prefixed key
 */
export function getCustomerKey(customerId, key) {
    return customerId ? `cust_${customerId}_${key}` : key;
}

/**
 * Generate customer ID
 * @returns {string} Customer ID
 */
export function generateCustomerId() {
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
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<object|null>} Customer data or null
 */
export async function getCustomer(customerId, env) {
    const customerKey = `customer_${customerId}`;
    const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' });
    return customer;
}

/**
 * Store customer
 * @param {string} customerId - Customer ID
 * @param {object} customerData - Customer data
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function storeCustomer(customerId, customerData, env) {
    const customerKey = `customer_${customerId}`;
    await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customerData));
    
    // Store email -> customerId mapping for lookup
    if (customerData.email) {
        const { hashEmail } = await import('../utils/crypto.js');
        const emailHash = await hashEmail(customerData.email.toLowerCase().trim());
        const emailMappingKey = `email_to_customer_${emailHash}`;
        await env.OTP_AUTH_KV.put(emailMappingKey, customerId);
    }
}

/**
 * Get customer by email
 * @param {string} email - Customer email
 * @param {*} env - Worker environment
 * @returns {Promise<object|null>} Customer data or null
 */
export async function getCustomerByEmail(email, env) {
    const { hashEmail } = await import('../utils/crypto.js');
    const emailHash = await hashEmail(email.toLowerCase().trim());
    const emailMappingKey = `email_to_customer_${emailHash}`;
    const customerId = await env.OTP_AUTH_KV.get(emailMappingKey);
    
    if (!customerId) {
        return null;
    }
    
    return await getCustomer(customerId, env);
}

