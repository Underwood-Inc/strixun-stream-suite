/**
 * Email Handler
 * Handles sending OTP emails with customer-specific templates
 */

import { getCustomerCached } from '../utils/cache.js';
import {
    renderEmailTemplate,
    getDefaultEmailTemplate,
    getDefaultTextTemplate,
    getEmailProvider
} from '../utils/email.js';
import { generateTrackingToken, generateTrackingPixel } from '../utils/tracking.js';

interface Customer {
    config?: {
        emailConfig?: {
            fromEmail?: string;
            fromName?: string;
            subjectTemplate?: string;
            htmlTemplate?: string | null;
            textTemplate?: string | null;
            variables?: Record<string, string | null>;
        };
    };
    companyName?: string;
}

interface Env {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    [key: string]: any;
}

/**
 * Send OTP email to customer
 * @param email - Recipient email address
 * @param otp - OTP code to send
 * @param customerId - Customer ID (optional, for multi-tenant)
 * @param env - Worker environment
 * @param trackingData - Optional tracking data (emailHash, otpKey, baseUrl)
 */
export async function sendOTPEmail(
    email: string, 
    otp: string, 
    customerId: string | null, 
    env: Env,
    trackingData?: {
        emailHash: string;
        otpKey: string;
        baseUrl: string;
        expiresAt?: string;
    }
): Promise<any> {
    // LOCAL DEV MODE: Check if we're in local development without email configured
    // This allows local testing without needing Resend API key
    const isLocalDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
    const hasResendKey = !!env.RESEND_API_KEY;
    
    if (isLocalDev && !hasResendKey) {
        // Local dev bypass - just log OTP to console and return success
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║                  LOCAL DEV MODE                        ║');
        console.log('║              Email Service Bypassed                    ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║  Email: ${email.padEnd(44)} ║`);
        console.log(`║  OTP Code: ${otp.padEnd(40)} ║`);
        console.log(`║  Expires: 10 minutes${' '.repeat(30)} ║`);
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log('║  Use this OTP code to complete authentication         ║');
        console.log('║  No email will be sent in local development           ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        
        return { 
            id: `local_dev_${Date.now()}`, 
            bypassed: true,
            email,
            otp,
            message: 'Local dev mode - check console for OTP code'
        };
    }
    
    // Production mode requires RESEND_API_KEY
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    // Get customer configuration if customerId provided
    let customer: Customer | null = null;
    let emailConfig: Customer['config']['emailConfig'] | null = null;
    let fromEmail = env.RESEND_FROM_EMAIL;
    let fromName = 'OTP Auth Service';
    let subjectTemplate = 'Your Verification Code - {{appName}}';
    let htmlTemplate: string | null = null;
    let textTemplate: string | null = null;
    let templateVariables: Record<string, string | null> = {
        appName: 'OTP Auth Service',
        brandColor: '#edae49', // Strixun Stream Suite brand accent color
        footerText: 'This is an automated message, please do not reply.',
        supportUrl: null,
        logoUrl: null
    };
    
    if (customerId) {
        const { getCustomer } = await import('../services/customer.js');
        customer = await getCustomerCached(customerId, (id) => getCustomer(id, env)) as Customer | null;
        if (customer?.config?.emailConfig) {
            emailConfig = customer.config.emailConfig;
            
            // Use customer's email config
            if (emailConfig.fromEmail) {
                fromEmail = emailConfig.fromEmail;
            }
            if (emailConfig.fromName) {
                fromName = emailConfig.fromName;
            }
            if (emailConfig.subjectTemplate) {
                subjectTemplate = emailConfig.subjectTemplate;
            }
            if (emailConfig.htmlTemplate) {
                htmlTemplate = emailConfig.htmlTemplate;
            }
            if (emailConfig.textTemplate) {
                textTemplate = emailConfig.textTemplate;
            }
            if (emailConfig.variables) {
                templateVariables = { ...templateVariables, ...emailConfig.variables };
            }
        }
    }
    
    // Fallback to default if no customer email configured
    if (!fromEmail) {
        throw new Error('RESEND_FROM_EMAIL must be set to your verified domain email (e.g., noreply@yourdomain.com). Set it via: wrangler secret put RESEND_FROM_EMAIL');
    }
    
    // Prepare template variables
    const variables: Record<string, string | number> = {
        ...templateVariables,
        otp,
        expiresIn: '10',
        expiresAt: trackingData?.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        userEmail: email,
        appName: templateVariables.appName || customer?.companyName || 'OTP Auth Service'
    };
    
    // Generate tracking pixel if tracking data is provided
    let trackingPixel = '';
    if (trackingData) {
        const trackingToken = generateTrackingToken(
            trackingData.emailHash,
            customerId,
            trackingData.otpKey
        );
        trackingPixel = generateTrackingPixel(trackingData.baseUrl, trackingToken);
    }
    variables.trackingPixel = trackingPixel;
    
    // Render templates (HTML template escapes variables for security, text does not)
    const html = renderEmailTemplate(htmlTemplate || getDefaultEmailTemplate(), variables, true);
    const text = renderEmailTemplate(textTemplate || getDefaultTextTemplate(), variables, false);
    const subject = renderEmailTemplate(subjectTemplate, variables, false);
    
    // Build from field
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    
    // Get email provider
    const provider = getEmailProvider(customer, env);
    
    try {
        // E2E TEST MODE: Intercept emails and store OTP in KV for test retrieval
        // SECURITY: Only intercept when ALL of these are true:
        // 1. ENVIRONMENT is 'test' (set by setup-test-secrets.js for local dev only)
        // 2. RESEND_API_KEY is a test key (starts with 're_test_' - only in .dev.vars)
        // 3. We're running locally (wrangler dev --local creates local KV)
        // 
        // PRODUCTION SAFETY:
        // - Production ENVIRONMENT is never 'test' (it's 'production' or undefined)
        // - Production RESEND_API_KEY is a real key (never starts with 're_test_')
        // - Production uses Cloudflare KV (not local filesystem)
        // - This code path is NEVER reached in production deployments
        const isLocalTestMode = env.ENVIRONMENT === 'test' && 
                                env.RESEND_API_KEY?.startsWith('re_test_');
        
        if (isLocalTestMode) {
            // Store OTP in KV with predictable key for E2E test retrieval
            // E2E tests will read from local KV filesystem (.wrangler/state/v3/kv)
            // This NEVER works in production because:
            // 1. Production uses Cloudflare KV (not local filesystem)
            // 2. ENVIRONMENT is never 'test' in production
            // 3. RESEND_API_KEY is never 're_test_' in production
            const emailHash = await (await import('../utils/crypto.js')).hashEmail(email);
            const e2eOTPKey = `e2e_otp_${emailHash}`;
            
            await env.OTP_AUTH_KV.put(e2eOTPKey, otp, { expirationTtl: 600 });
            
            // Log OTP code to console for easy dev access
            console.log('[E2E] OTP intercepted and stored in local KV:', e2eOTPKey);
            console.log(`[DEV] OTP Code for ${email}: ${otp}`);
            console.log(`[DEV] Retrieve OTP via: GET /dev/otp?email=${encodeURIComponent(email)}`);
            
            // In local test mode, don't actually send email (skip Resend API call)
            return { id: `e2e_${Date.now()}`, intercepted: true };
        }
        
        // Send email using provider (production or when RESEND_API_KEY is set)
        const result = await provider.sendEmail({
            from: from,
            to: email,
            subject: subject,
            html: html,
            text: text
        });
        
        console.log('Email sent successfully:', result);
        return result;
    } catch (error: any) {
        // Log detailed error for debugging
        console.error('Email sending error:', {
            message: error?.message,
            stack: error?.stack,
            email: email.toLowerCase().trim(),
            customerId: customerId,
            provider: customer?.config?.emailProvider?.type || 'resend'
        });
        
        throw error;
    }
}

