/**
 * Customer Email Lookup Utility
 * 
 * SECURITY: Email addresses are NEVER passed around in auth objects.
 * They are only fetched when needed via customerId lookup.
 * This ensures OTP emails remain secure and are only accessible to the OTP auth service.
 */

import { fetchCustomerByCustomerId } from '@strixun/api-framework';

/**
 * Fetch email for a customer by customerId
 * 
 * SECURITY: This is the ONLY way to get a customer's email address.
 * Email is NEVER stored in auth objects or passed between services.
 * 
 * @param customerId - Customer ID to lookup
 * @param env - Environment variables
 * @param required - If true, throws error when email not found (default: false)
 * @returns Email address or null if not found (when required=false)
 * @throws Error if email not found and required=true
 */
export async function getCustomerEmail(
    customerId: string | undefined,
    env: any,
    required: boolean = false
): Promise<string | null> {
    if (!customerId) {
        if (required) {
            throw new Error('Customer ID is required to fetch email');
        }
        return null;
    }
    
    try {
        const customer = await fetchCustomerByCustomerId(customerId, env);
        const email = customer?.email || null;
        
        if (!email && required) {
            throw new Error(`Email not found for customerId: ${customerId}`);
        }
        
        return email;
    } catch (error) {
        console.error('[CustomerEmail] Failed to fetch email for customerId:', { customerId, error });
        if (required) {
            throw error;
        }
        return null;
    }
}
