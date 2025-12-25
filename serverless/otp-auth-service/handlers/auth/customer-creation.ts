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
    SERVICE_API_KEY?: string; // Service-to-service API key for customer-api
    [key: string]: any;
}

/**
 * Ensure customer account exists for a verified user
 * Creates account if it doesn't exist, returns existing customerId if it does
 * 
 * This function implements smart account recovery:
 * - If user account was deleted (expired TTL), customer account is recovered by email
 * - Customer accounts persist indefinitely to allow recovery
 * - When recovered, customer account status is reactivated if it was inactive
 * 
 * @returns Resolved customerId (may be null if creation failed)
 */
export async function ensureCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string | null> {
    // If customerId is already provided, verify it exists
    if (customerId) {
        try {
            const existing = await getCustomerService(customerId, env);
            if (existing) {
                // Customer exists, but check if we need to reactivate it
                if (existing.status === 'suspended' || existing.status === 'cancelled') {
                    console.log(`[Customer Creation] Reactivating customer account: ${customerId}`);
                    existing.status = 'active';
                    existing.updatedAt = new Date().toISOString();
                    await updateCustomerService(customerId, existing, env);
                }
                return customerId;
            }
        } catch (error) {
            console.warn(`[Customer Creation] Error checking customer ${customerId}:`, error);
        }
        // CustomerId in JWT but doesn't exist - try to recover by email
        console.warn(`[Customer Creation] CustomerId ${customerId} in JWT but not found, attempting recovery by email`);
    }
    
    try {
        const emailLower = email.toLowerCase().trim();
        console.log(`[Customer Creation] Looking up customer by email: ${emailLower}`);
        
        // Check for existing customer by email (smart recovery for reactivated accounts)
        const existingCustomer = await getCustomerByEmailService(emailLower, env);
        if (existingCustomer) {
            console.log(`[Customer Creation] Found existing customer account: ${existingCustomer.customerId} (recovered)`);
            
            // Reactivate customer account if it was suspended/cancelled
            if (existingCustomer.status === 'suspended' || existingCustomer.status === 'cancelled') {
                console.log(`[Customer Creation] Reactivating customer account: ${existingCustomer.customerId}`);
                existingCustomer.status = 'active';
                existingCustomer.updatedAt = new Date().toISOString();
                await updateCustomerService(existingCustomer.customerId, existingCustomer, env);
            }
            
            return existingCustomer.customerId;
        }
        
        // Create new customer account
        console.log(`[Customer Creation] No existing customer found, auto-creating customer account for: ${emailLower}`);
        const resolvedCustomerId = generateCustomerId();
        const emailDomain = emailLower.split('@')[1] || 'unknown';
        const companyName = emailDomain.split('.')[0] || 'My App';
        
        // Generate random display name for customer account
        const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
        const customerDisplayName = await generateUniqueDisplayName({
            customerId: resolvedCustomerId,
            maxAttempts: 10,
            includeNumber: true
        }, env);
        
        // Reserve the display name for the customer account
        // Note: Customer accounts use customerId as userId for display name reservation
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
        
        // Create customer via customer-api (service-to-service call)
        await createCustomerService(customerData, env);
        console.log(`[Customer Creation] Customer account created via customer-api: ${resolvedCustomerId} for ${emailLower}`);
        
        // Verify the customer was stored correctly (with retry for eventual consistency)
        let verifyCustomer = await getCustomerByEmailService(emailLower, env);
        if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
            // Wait a bit and retry (KV eventual consistency)
            await new Promise(resolve => setTimeout(resolve, 100));
            verifyCustomer = await getCustomerByEmailService(emailLower, env);
        }
        
        if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
            console.warn(`[Customer Creation] WARNING: Customer account verification failed! Expected ${resolvedCustomerId}, got ${verifyCustomer?.customerId || 'null'}. Continuing anyway.`);
            // Don't throw - continue with OTP verification even if customer creation had issues
        }
        
        // Generate initial API key for the customer
        // This allows users to immediately use the API without additional signup steps
        // Wrap in try-catch to prevent API key creation failures from blocking OTP verification
        try {
            await createApiKeyForCustomer(resolvedCustomerId, 'Initial API Key', env);
            console.log(`[Customer Creation] API key created for customer: ${resolvedCustomerId}`);
        } catch (apiKeyError) {
            console.error(`[Customer Creation] WARNING: Failed to create API key for customer ${resolvedCustomerId}:`, apiKeyError.message);
            // Don't throw - continue with OTP verification even if API key creation failed
        }
        
        return resolvedCustomerId;
    } catch (customerError) {
        console.error(`[Customer Creation] ERROR: Customer account creation/lookup failed:`, customerError);
        // Don't throw - continue with OTP verification using null customerId
        // The user can still authenticate, they just won't have a customer account
        return null;
    }
}

