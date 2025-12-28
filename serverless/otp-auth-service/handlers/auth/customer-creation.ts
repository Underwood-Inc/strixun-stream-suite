/**
 * Customer Account Creation Utilities
 * 
 * Handles automatic customer account creation for OTP-verified users
 */

import { generateCustomerId } from '../../services/customer.js';
import { createApiKeyForCustomer } from '../../services/api-key.js';
import { 
    getCustomerByEmailService, 
    createCustomerService, 
    getCustomerService,
    updateCustomerService 
} from '../../utils/customer-api-service-client.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    CUSTOMER_API_URL?: string;
    SERVICE_API_KEY?: string; // Service-to-service API key for customer-api (REQUIRED)
    NETWORK_INTEGRITY_KEYPHRASE?: string; // Network integrity keyphrase (REQUIRED)
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
        } catch (error) {
            console.warn(`[Customer Creation] Error fetching customer by ID ${customerId}:`, error);
        }
    }
    
    if (!existingCustomer) {
        try {
            existingCustomer = await getCustomerByEmailService(emailLower, env);
        } catch (error) {
            console.warn(`[Customer Creation] Error fetching customer by email ${emailLower}:`, error);
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
        
        // Ensure email matches (in case of email change)
        if (existingCustomer.email !== emailLower) {
            updates.email = emailLower;
            needsUpdate = true;
        }
        
        // Ensure required fields exist
        if (!existingCustomer.displayName) {
            const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
            const customerDisplayName = await generateUniqueDisplayName({
                customerId: resolvedCustomerId,
                maxAttempts: 10,
                includeNumber: true
            }, env);
            await reserveDisplayName(customerDisplayName, resolvedCustomerId, resolvedCustomerId, env);
            updates.displayName = customerDisplayName;
            needsUpdate = true;
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
                await updateCustomerService(resolvedCustomerId, { ...existingCustomer, ...updates }, env);
            });
        }
        
        return resolvedCustomerId;
    }
    
    // Create new customer account
    console.log(`[Customer Creation] Creating new customer account for: ${emailLower}`);
    const resolvedCustomerId = generateCustomerId();
    
    // Generate random display name for customer account
    const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
    const customerDisplayName = await generateUniqueDisplayName({
        customerId: resolvedCustomerId,
        maxAttempts: 10,
        includeNumber: true
    }, env);
    
    // Reserve the display name for the customer account
    await reserveDisplayName(customerDisplayName, resolvedCustomerId, resolvedCustomerId, env);
    
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
        name: emailLower.split('@')[0], // Use email prefix as name
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
        await createCustomerService(customerData, env);
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
    
    // Generate initial API key for the customer (non-blocking)
    try {
        await createApiKeyForCustomer(resolvedCustomerId, 'Initial API Key', env);
        console.log(`[Customer Creation] API key created for customer: ${resolvedCustomerId}`);
    } catch (apiKeyError) {
        console.error(`[Customer Creation] WARNING: Failed to create API key for customer ${resolvedCustomerId}:`, apiKeyError);
        // Don't throw - API key creation is not critical for login
    }
    
    return resolvedCustomerId;
}

export async function ensureCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string> {
    const emailLower = email.toLowerCase().trim();
    
    // CRITICAL: Validate required environment variables before attempting customer creation
    if (!env.SERVICE_API_KEY) {
        const errorMsg = 'SERVICE_API_KEY is not configured in otp-auth-service. This is required for service-to-service calls to customer-api. Set it via: wrangler secret put SERVICE_API_KEY';
        console.error(`[Customer Creation] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    if (!env.NETWORK_INTEGRITY_KEYPHRASE) {
        const errorMsg = 'NETWORK_INTEGRITY_KEYPHRASE is not configured in otp-auth-service. This is required for service-to-service calls to customer-api. Set it via: wrangler secret put NETWORK_INTEGRITY_KEYPHRASE';
        console.error(`[Customer Creation] ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    try {
        // UPSERT customer account with retry logic
        const resolvedCustomerId = await retryWithBackoff(async () => {
            return await upsertCustomerAccount(emailLower, customerId, env);
        }, 3, 100);
        
        if (!resolvedCustomerId) {
            throw new Error(`Failed to create or retrieve customer account for ${emailLower}`);
        }
        
        return resolvedCustomerId;
    } catch (error) {
        console.error(`[Customer Creation] CRITICAL ERROR: Customer account creation/lookup failed after retries for ${emailLower}:`, error);
        
        // Provide more specific error messages based on error type
        let errorMessage = `Failed to ensure customer account exists for ${emailLower}. This is required for login.`;
        
        if (error instanceof Error) {
            const errorMsg = error.message;
            
            // Check for authentication errors (401)
            if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('Authentication required')) {
                errorMessage = `Service authentication failed. Please verify that SERVICE_API_KEY is set correctly in both otp-auth-service and customer-api workers, and that they match. Error: ${errorMsg}`;
            }
            // Check for missing environment variable errors
            else if (errorMsg.includes('SERVICE_API_KEY') || errorMsg.includes('NETWORK_INTEGRITY_KEYPHRASE')) {
                errorMessage = errorMsg; // Use the specific error message from validation
            }
            // Check for network/integrity errors
            else if (errorMsg.includes('integrity') || errorMsg.includes('NETWORK_INTEGRITY')) {
                errorMessage = `Network integrity verification failed. Please verify that NETWORK_INTEGRITY_KEYPHRASE is set correctly in both otp-auth-service and customer-api workers, and that they match. Error: ${errorMsg}`;
            }
            else {
                errorMessage = `${errorMessage} Error: ${errorMsg}`;
            }
        }
        
        // BUSINESS RULE: Customer account MUST ALWAYS be created - throw error instead of returning null
        throw new Error(errorMessage);
    }
}

