/**
 * Customer Account Creation Utilities
 * 
 * Handles automatic customer account creation for OTP-verified users
 */

import { generateCustomerId, storeCustomer, getCustomerByEmail } from '../../services/customer.js';
import { createApiKeyForCustomer } from '../../services/api-key.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Ensure customer account exists for a verified user
 * Creates account if it doesn't exist, returns existing customerId if it does
 * 
 * @returns Resolved customerId (may be null if creation failed)
 */
export async function ensureCustomerAccount(
    email: string,
    customerId: string | null,
    env: Env
): Promise<string | null> {
    // If customerId is already provided, use it
    if (customerId) {
        return customerId;
    }
    
    try {
        const emailLower = email.toLowerCase().trim();
        console.log(`[Customer Creation] No customerId provided, looking up customer by email: ${emailLower}`);
        
        // Check for existing customer
        const existingCustomer = await getCustomerByEmail(emailLower, env);
        if (existingCustomer) {
            console.log(`[Customer Creation] Found existing customer: ${existingCustomer.customerId}`);
            return existingCustomer.customerId;
        }
        
        // Create new customer account
        console.log(`[Customer Creation] No existing customer found, auto-creating customer account for: ${emailLower}`);
        const resolvedCustomerId = generateCustomerId();
        const emailDomain = emailLower.split('@')[1] || 'unknown';
        const companyName = emailDomain.split('.')[0] || 'My App';
        
        const customerData = {
            customerId: resolvedCustomerId,
            name: emailLower.split('@')[0], // Use email prefix as name
            email: emailLower,
            companyName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
            plan: 'free',
            status: 'active',
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
        
        // Store customer BEFORE creating JWT to ensure it exists
        await storeCustomer(resolvedCustomerId, customerData, env);
        console.log(`[Customer Creation] Customer account created and stored: ${resolvedCustomerId} for ${emailLower}`);
        
        // Verify the customer was stored correctly (with retry for eventual consistency)
        let verifyCustomer = await getCustomerByEmail(emailLower, env);
        if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
            // Wait a bit and retry (KV eventual consistency)
            await new Promise(resolve => setTimeout(resolve, 100));
            verifyCustomer = await getCustomerByEmail(emailLower, env);
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

