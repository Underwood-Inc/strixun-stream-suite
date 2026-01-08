/**
 * Customer Account Creation Utilities
 * 
 * Handles automatic customer account creation for OTP-verified users
 */

import { generateCustomerId } from '../../services/customer.js';
// CRITICAL: API keys are ONLY created manually through the auth dashboard
// Removed import - we do NOT automatically create API keys
import { 
    getCustomerByEmailService, 
    createCustomer, 
    getCustomerService,
    updateCustomer 
} from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    CUSTOMER_API_URL?: string;
    [key: string]: any;
}

/**
 * Ensure customer account exists for a verified user
 * Creates account if it doesn't exist, returns existing customerId if it does
 * 
 * BUSINESS RULE: Customer account MUST ALWAYS be created for users on login.
 * This function will retry on failures and throw an error if it cannot create
 * the account after retries, rather than returning null.
 * 
 * This function implements smart account recovery:
 * - If user account was deleted (expired TTL), customer account is recovered by email
 * - Customer accounts persist indefinitely to allow recovery
 * - When recovered, customer account status is reactivated if it was inactive
 * 
 * @returns Resolved customerId (never null - throws error if cannot create)
 * @throws Error if customer account cannot be created after retries
 */
/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`[Customer Creation] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('Retry failed after all attempts');
}

/**
 * UPSERT customer account - update existing or create new
 * Ensures all required fields are present and account is active
 */
async function upsertCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string> {
    const emailLower = email.toLowerCase().trim();
    const emailDomain = emailLower.split('@')[1] || 'unknown';
    const companyName = emailDomain.split('.')[0] || 'My App';
    
    // Try to get existing customer by ID or email
    let existingCustomer: import('../../services/customer.js').CustomerData | null = null;
    
    if (customerId) {
        try {
            existingCustomer = await getCustomerService(customerId, env);
            if (existingCustomer) {
                console.log(`[Customer Creation] Found existing customer by ID: ${customerId}`);
            }
        } catch (error) {
            console.warn(`[Customer Creation] Error fetching customer by ID ${customerId}:`, error);
        }
    }
    
    if (!existingCustomer) {
        try {
            existingCustomer = await getCustomerByEmailService(emailLower, env);
            if (existingCustomer) {
                console.log(`[Customer Creation] Found existing customer by email: ${emailLower} (customerId: ${existingCustomer.customerId})`);
            } else {
                console.log(`[Customer Creation] No customer found by email: ${emailLower} - will create new customer`);
            }
        } catch (error) {
            // If it's a 500 error, the customer API might be having issues
            // Log the error but continue - we'll try to create the customer anyway
            // If customer already exists, creation will fail and we can handle that
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isServerError = errorMessage.includes('internal error') || errorMessage.includes('Internal Server Error');
            
            if (isServerError) {
                console.warn(`[Customer Creation] Customer API returned server error when fetching by email ${emailLower}. Will attempt to create customer if it doesn't exist. Error:`, errorMessage);
            } else {
                console.warn(`[Customer Creation] Error fetching customer by email ${emailLower}. Will attempt to create customer if it doesn't exist. Error:`, error);
            }
            // Continue - if customer exists, creation will fail and we'll handle it in retry logic
            // existingCustomer remains null, so we'll proceed to create
        }
    }
    
    // If customer exists, UPSERT (update if needed)
    if (existingCustomer) {
        const resolvedCustomerId = existingCustomer.customerId;
        let needsUpdate = false;
        const updates: Partial<import('../../services/customer.js').CustomerData> = {};
        
        // Ensure status is active (reactivate if suspended/cancelled)
        if (existingCustomer.status === 'suspended' || existingCustomer.status === 'cancelled') {
            console.log(`[Customer Creation] Reactivating customer account: ${resolvedCustomerId}`);
            updates.status = 'active';
            needsUpdate = true;
        }
        
        // CRITICAL: Email is IMMUTABLE - it's the authentication identifier
        // If email doesn't match, log a warning but DO NOT change it
        if (existingCustomer.email !== emailLower) {
            console.warn(`[Customer Creation] Email mismatch for customer ${resolvedCustomerId}: stored="${existingCustomer.email}", login="${emailLower}". Email is immutable - keeping stored value.`);
        }
        
        // FAIL-FAST: displayName is MANDATORY - customer cannot exist without it
        // Check for undefined, null, empty string, or whitespace-only
        if (!existingCustomer.displayName || existingCustomer.displayName.trim() === '') {
            // FAIL-FAST: Generate globally unique displayName - MANDATORY
            const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
            const customerDisplayName = await generateUniqueDisplayName({
                maxAttempts: 50, // More attempts to ensure uniqueness
                pattern: 'random'
            }, env);
            
            // FAIL-FAST: displayName generation must succeed
            if (!customerDisplayName || customerDisplayName.trim() === '') {
                throw new Error(`Failed to generate globally unique displayName for customer ${resolvedCustomerId} after 50 retries. Customer cannot exist without a display name.`);
            }
            
            await reserveDisplayName(customerDisplayName, resolvedCustomerId, null, env); // Global scope - ensures uniqueness
            updates.displayName = customerDisplayName;
            needsUpdate = true;
            console.log(`[Customer Creation] Generated displayName "${customerDisplayName}" for customer ${resolvedCustomerId}`);
        }
        
        // Ensure subscriptions exist
        if (!existingCustomer.subscriptions || existingCustomer.subscriptions.length === 0) {
            updates.subscriptions = [{
                planId: 'free',
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: null,
                planName: 'Free',
                billingCycle: 'monthly',
            }];
            needsUpdate = true;
        }
        
        // Ensure config exists
        if (!existingCustomer.config) {
            updates.config = {
                emailConfig: {
                    fromEmail: null,
                    fromName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                    subjectTemplate: 'Your {{appName}} Verification Code',
                    htmlTemplate: null,
                    textTemplate: null,
                    variables: {
                        appName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                        brandColor: '#007bff',
                        footerText: `© ${new Date().getFullYear()} ${companyName.charAt(0).toUpperCase() + companyName.slice(1)}`,
                        supportUrl: null,
                        logoUrl: null
                    }
                },
                rateLimits: {
                    otpRequestsPerHour: 3,
                    otpRequestsPerDay: 50,
                    maxUsers: 100
                },
                webhookConfig: {
                    url: null,
                    secret: null,
                    events: []
                },
                allowedOrigins: []
            };
            needsUpdate = true;
        }
        
        // Update if needed
        if (needsUpdate) {
            updates.updatedAt = new Date().toISOString();
            console.log(`[Customer Creation] Updating customer account: ${resolvedCustomerId}`);
            await retryWithBackoff(async () => {
                await updateCustomer(resolvedCustomerId, { ...existingCustomer, ...updates }, env);
            });
        }
        
        return resolvedCustomerId;
    }
    
    // Create new customer account
    console.log(`[Customer Creation] Creating new customer account for: ${emailLower}`);
    const resolvedCustomerId = generateCustomerId();
    
    // FAIL-FAST: Generate globally unique display name for customer account - MANDATORY
    // Customer cannot exist without a display name
    const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
    const customerDisplayName = await generateUniqueDisplayName({
        maxAttempts: 50, // More attempts to ensure global uniqueness
        pattern: 'random'
    }, env);
    
    // FAIL-FAST: displayName generation must succeed - customer cannot exist without it
    if (!customerDisplayName || customerDisplayName.trim() === '') {
        throw new Error('Failed to generate globally unique displayName after 50 retries. Customer cannot exist without a display name.');
    }
    
    // Reserve the display name for the customer account (global scope)
    await reserveDisplayName(customerDisplayName, resolvedCustomerId, null, env);
    
    // Initialize default subscription (free tier)
    const defaultSubscription: import('../../services/customer.js').Subscription = {
        planId: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: null,
        planName: 'Free',
        billingCycle: 'monthly',
    };
    
    const customerData: import('../../services/customer.js').CustomerData = {
        customerId: resolvedCustomerId,
        email: emailLower,
        companyName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
        plan: 'free', // Legacy field
        tier: 'free', // Current tier level
        status: 'active',
        displayName: customerDisplayName, // Randomly generated display name
        subscriptions: [defaultSubscription], // Initialize with free subscription
        flairs: [], // Initialize empty flairs array
        createdAt: new Date().toISOString(),
        configVersion: 1,
        config: {
            emailConfig: {
                fromEmail: null,
                fromName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                subjectTemplate: 'Your {{appName}} Verification Code',
                htmlTemplate: null,
                textTemplate: null,
                variables: {
                    appName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                    brandColor: '#007bff',
                    footerText: `© ${new Date().getFullYear()} ${companyName.charAt(0).toUpperCase() + companyName.slice(1)}`,
                    supportUrl: null,
                    logoUrl: null
                }
            },
            rateLimits: {
                otpRequestsPerHour: 3,
                otpRequestsPerDay: 50,
                maxUsers: 100
            },
            webhookConfig: {
                url: null,
                secret: null,
                events: []
            },
            allowedOrigins: []
        },
        features: {
            customEmailTemplates: false,
            webhooks: false,
            analytics: false,
            sso: false
        }
    };
    
    // Create customer via customer-api with retry
    await retryWithBackoff(async () => {
        await createCustomer(customerData, env);
    });
    console.log(`[Customer Creation] Customer account created via customer-api: ${resolvedCustomerId} for ${emailLower}`);
    
    // Verify the customer was stored correctly (with retry for eventual consistency)
    let verifyCustomer = await retryWithBackoff(async () => {
        const customer = await getCustomerByEmailService(emailLower, env);
        if (!customer || customer.customerId !== resolvedCustomerId) {
            throw new Error(`Customer verification failed: expected ${resolvedCustomerId}, got ${customer?.customerId || 'null'}`);
        }
        return customer;
    }, 5, 200); // More retries for verification due to eventual consistency
    
    if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
        throw new Error(`Customer account verification failed after retries. Expected ${resolvedCustomerId}, got ${verifyCustomer?.customerId || 'null'}`);
    }
    
    // CRITICAL: API keys are ONLY created manually through the auth dashboard
    // We do NOT automatically create API keys during customer creation
    // API keys are optional for multi-tenant identification (subscription tiers, rate limiting)
    
    return resolvedCustomerId;
}

export async function ensureCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string> {
    const emailLower = email.toLowerCase().trim();
    
    try {
        // UPSERT customer account (retry logic is handled internally by upsertCustomerAccount)
        const resolvedCustomerId = await upsertCustomerAccount(emailLower, customerId, env);
        
        if (!resolvedCustomerId) {
            throw new Error(`Failed to create or retrieve customer account for ${emailLower}`);
        }
        
        // CRITICAL: Clean up any customer data from OTP_AUTH_KV
        // This runs on every login to gradually migrate all users
        await cleanupOTPAuthKV(resolvedCustomerId, emailLower, env);
        
        return resolvedCustomerId;
    } catch (error) {
        console.error(`[Customer Creation] CRITICAL ERROR: Customer account creation/lookup failed after retries for ${emailLower}:`, error);
        
        // Provide more specific error messages based on error type
        let errorMessage = `Failed to ensure customer account exists for ${emailLower}. This is required for login.`;
        
        if (error instanceof Error) {
            const errorMsg = error.message;
            errorMessage = `${errorMessage} Error: ${errorMsg}`;
        }
        
        // BUSINESS RULE: Customer account MUST ALWAYS be created - throw error instead of returning null
        throw new Error(errorMessage);
    }
}

/**
 * Clean up customer data from OTP_AUTH_KV
 * Removes customer data that should only exist in CUSTOMER_KV
 * Runs on every login to gradually migrate all users
 */
export async function cleanupOTPAuthKV(
    customerId: string,
    email: string,
    env: Env
): Promise<void> {
    try {
        // Guard: Skip if OTP_AUTH_KV not available (e.g., in unit tests)
        if (!env.OTP_AUTH_KV || typeof env.OTP_AUTH_KV.get !== 'function') {
            return;
        }
        
        const { hashEmail } = await import('../../utils/crypto.js');
        const emailHash = await hashEmail(email);
        const { getCustomerKey } = await import('../../services/customer.js');
        
        // Get customer session from OTP_AUTH_KV
        const sessionKey = getCustomerKey(customerId, `user_${emailHash}`);
        const session = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as any;
        
        if (session) {
            // Keep only authentication-related fields
            const cleanSession = {
                customerId: session.customerId,
                email: session.email,
                createdAt: session.createdAt,
                lastLogin: session.lastLogin,
                // Remove: displayName (customer data)
                // Remove: preferences (customer data)
                // Remove: any other customer data
            };
            
            // Update session with cleaned data
            await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(cleanSession), { expirationTtl: 31536000 });
            console.log(`[Cleanup] Removed customer data from OTP_AUTH_KV session for customer ${customerId}`);
        }
        
        // Remove preferences from OTP_AUTH_KV (now in CUSTOMER_KV)
        const prefsKey = getCustomerKey(customerId, `customer_preferences_${customerId}`);
        const oldPrefs = await env.OTP_AUTH_KV.get(prefsKey);
        if (oldPrefs) {
            await env.OTP_AUTH_KV.delete(prefsKey);
            console.log(`[Cleanup] Removed preferences from OTP_AUTH_KV for customer ${customerId}`);
        }
        
        console.log(`[Cleanup] Successfully cleaned OTP_AUTH_KV for customer ${customerId}`);
    } catch (error) {
        // Don't fail login if cleanup fails - just log the error
        console.error(`[Cleanup] Error cleaning OTP_AUTH_KV for customer ${customerId}:`, error);
    }
}
