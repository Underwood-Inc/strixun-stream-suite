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

/**
 * Send OTP email to user
 * @param {string} email - User email address
 * @param {string} otp - OTP code
 * @param {string|null} customerId - Customer ID for multi-tenant isolation
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Email provider response
 */
export async function sendOTPEmail(email, otp, customerId, env) {
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    // Get customer configuration if customerId provided
    let customer = null;
    let emailConfig = null;
    let fromEmail = env.RESEND_FROM_EMAIL;
    let fromName = 'OTP Auth Service';
    let subjectTemplate = 'Your Verification Code - {{appName}}';
    let htmlTemplate = null;
    let textTemplate = null;
    let templateVariables = {
        appName: 'OTP Auth Service',
        brandColor: '#007bff',
        footerText: 'This is an automated message, please do not reply.',
        supportUrl: null,
        logoUrl: null
    };
    
    if (customerId) {
        const { getCustomer } = await import('../services/customer.js');
        customer = await getCustomerCached(customerId, (id) => getCustomer(id, env));
        if (customer && customer.config && customer.config.emailConfig) {
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
    const variables = {
        ...templateVariables,
        otp,
        expiresIn: '10',
        userEmail: email,
        appName: templateVariables.appName || customer?.companyName || 'OTP Auth Service'
    };
    
    // Render templates (HTML template escapes variables for security, text does not)
    const html = renderEmailTemplate(htmlTemplate || getDefaultEmailTemplate(), variables, true);
    const text = renderEmailTemplate(textTemplate || getDefaultTextTemplate(), variables, false);
    const subject = renderEmailTemplate(subjectTemplate, variables, false);
    
    // Build from field
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    
    // Get email provider
    const provider = getEmailProvider(customer, env);
    
    try {
        // Send email using provider
        const result = await provider.sendEmail({
            from: from,
            to: email,
            subject: subject,
            html: html,
            text: text
        });
        
        console.log('Email sent successfully:', result);
        return result;
    } catch (error) {
        // Log detailed error for debugging
        console.error('Email sending error:', {
            message: error.message,
            stack: error.stack,
            email: email.toLowerCase().trim(),
            customerId: customerId,
            provider: customer?.config?.emailProvider?.type || 'resend'
        });
        
        throw error;
    }
}

