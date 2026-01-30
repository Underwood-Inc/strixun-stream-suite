/**
 * Configuration Management Handlers
 * Handles customer configuration endpoints
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getCustomer, storeCustomer } from '../../services/customer.js';
import { invalidateCustomerCache } from '../../utils/cache.js';
import { validateCustomerConfig } from '../../utils/validation.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface EmailConfig {
    fromEmail?: string | null;
    fromName?: string;
    subjectTemplate?: string;
    htmlTemplate?: string | null;
    textTemplate?: string | null;
    variables?: Record<string, string | null>;
}

interface RateLimits {
    otpRequestsPerHour?: number;
    otpRequestsPerDay?: number;
    maxUsers?: number;
}

interface WebhookConfig {
    url?: string | null;
    secret?: string | null;
    events?: string[];
}

interface CustomerConfig {
    emailConfig?: EmailConfig;
    rateLimits?: RateLimits;
    webhookConfig?: WebhookConfig;
    allowedOrigins?: string[];
}

/**
 * Get customer configuration
 * GET /admin/config
 */
export async function handleGetConfig(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            config: customer.config || {},
            configVersion: customer.configVersion || 1,
            plan: customer.plan,
            features: customer.features
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to get configuration',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update customer configuration
 * PUT /admin/config
 */
export async function handleUpdateConfig(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json() as { config?: CustomerConfig };
        const { config } = body;
        
        if (!config) {
            return new Response(JSON.stringify({ error: 'Configuration object required' }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Merge with existing config (partial updates allowed)
        const existingConfig: CustomerConfig = customer.config || {};
        const mergedConfig: CustomerConfig = {
            emailConfig: { ...existingConfig.emailConfig, ...(config.emailConfig || {}) },
            rateLimits: { ...existingConfig.rateLimits, ...(config.rateLimits || {}) },
            webhookConfig: { ...existingConfig.webhookConfig, ...(config.webhookConfig || {}) },
            allowedOrigins: config.allowedOrigins !== undefined ? config.allowedOrigins : existingConfig.allowedOrigins
        };
        
        // Validate configuration
        const validation = await validateCustomerConfig(mergedConfig, customer);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: 'Invalid configuration',
                errors: validation.errors
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update customer with new config
        customer.config = mergedConfig;
        customer.configVersion = (customer.configVersion || 1) + 1;
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        // Invalidate cache
        invalidateCustomerCache(customerId);
        
        return new Response(JSON.stringify({
            success: true,
            config: customer.config,
            configVersion: customer.configVersion,
            message: 'Configuration updated successfully'
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to update configuration',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update email configuration
 * PUT /admin/config/email
 */
export async function handleUpdateEmailConfig(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailConfig = await request.json() as EmailConfig;
        
        // Merge with existing email config
        const existingConfig: CustomerConfig = customer.config || {};
        const existingEmailConfig: EmailConfig = existingConfig.emailConfig || {};
        const mergedEmailConfig: EmailConfig = { ...existingEmailConfig, ...emailConfig };
        
        // Validate
        const validation = await validateCustomerConfig({ emailConfig: mergedEmailConfig }, customer);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: 'Invalid email configuration',
                errors: validation.errors
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update
        if (!customer.config) customer.config = {};
        customer.config.emailConfig = mergedEmailConfig;
        customer.configVersion = (customer.configVersion || 1) + 1;
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        // Invalidate cache
        invalidateCustomerCache(customerId);
        
        return new Response(JSON.stringify({
            success: true,
            emailConfig: customer.config.emailConfig,
            message: 'Email configuration updated successfully'
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to update email configuration',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
