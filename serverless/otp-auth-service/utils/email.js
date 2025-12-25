/**
 * Email utilities
 * Template rendering, email providers, and sending logic
 */

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Render email template with variables
 * @param {string} template - Template string
 * @param {object} variables - Variables to substitute
 * @param {boolean} isHtml - Whether this is an HTML template (escape variables)
 * @returns {string} Rendered template
 */
export function renderEmailTemplate(template, variables, isHtml = false) {
    if (!template) return '';
    
    let rendered = template;
    
    // Replace all variables (case-insensitive)
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        // For HTML templates, escape variables to prevent XSS (except for otp which is safe)
        // For text templates, use as-is
        const replacement = isHtml && key !== 'otp' ? escapeHtml(value || '') : (value || '');
        rendered = rendered.replace(regex, replacement);
    }
    
    return rendered;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let emailTemplateCache = null;

/**
 * Get default email template
 * Uses Strixun Stream Suite brand colors:
 * - Accent: #edae49 (golden yellow)
 * - Accent dark: #c68214
 * - Background: #1a1611 (dark brown)
 * - Card: #252017
 * - Text: #f9f9f9
 * - Text secondary: #b8b8b8
 * @returns {string} Default HTML template
 */
export function getDefaultEmailTemplate() {
    if (emailTemplateCache === null) {
        try {
            const templatePath = join(__dirname, '../templates/email-template.html');
            emailTemplateCache = readFileSync(templatePath, 'utf-8');
        } catch (error) {
            // Fallback to inline template if file not found (e.g., in Workers runtime)
            emailTemplateCache = getFallbackTemplate();
        }
    }
    return emailTemplateCache;
}

function getFallbackTemplate() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            color: #1a1611; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .email-wrapper {
            background-color: #ffffff;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 32px 24px;
            background-color: #ffffff;
        }
        .header {
            border-bottom: 2px solid #edae49;
            padding-bottom: 20px;
            margin-bottom: 24px;
        }
        h1 { 
            font-size: 24px;
            font-weight: 600;
            color: #1a1611;
            margin: 0 0 8px 0;
            line-height: 1.3;
        }
        .content {
            color: #1a1611;
            font-size: 16px;
            line-height: 1.6;
        }
        .otp-code { 
            font-size: 36px; 
            font-weight: bold; 
            letter-spacing: 10px; 
            text-align: center;
            background: linear-gradient(135deg, #edae49 0%, #c68214 100%);
            color: #1a1611;
            padding: 24px;
            border-radius: 8px;
            margin: 32px 0;
            font-family: 'Courier New', monospace;
            box-shadow: 0 4px 12px rgba(237, 174, 73, 0.2);
            border: 2px solid #c68214;
        }
        .expires-text {
            color: #1a1611;
            font-size: 14px;
            margin: 16px 0;
        }
        .expires-text strong {
            color: #c68214;
        }
        .footer { 
            margin-top: 40px; 
            padding-top: 24px;
            border-top: 1px solid #e0e0e0;
            font-size: 12px; 
            color: #888888;
            line-height: 1.5;
        }
        .footer p {
            margin: 4px 0;
        }
        .brand-name {
            color: #edae49;
            font-weight: 600;
        }
        @media only screen and (max-width: 600px) {
            .container {
                padding: 24px 16px;
            }
            .otp-code {
                font-size: 28px;
                letter-spacing: 6px;
                padding: 20px;
            }
            h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            <div class="header">
                <h1>Your Verification Code</h1>
            </div>
            <div class="content">
                <p>Use this code to verify your email address:</p>
                <div class="otp-code">{{otp}}</div>
                <p class="expires-text">This code will expire in <strong>{{expiresIn}} minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
                <p><span class="brand-name">{{appName}}</span></p>
                <p>{{footerText}}</p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Get default text email template
 * @returns {string} Default text template
 */
export function getDefaultTextTemplate() {
    return `Your Verification Code

Use this code to verify your email address: {{otp}}

This code will expire in {{expiresIn}} minutes.

If you didn't request this code, please ignore this email.

{{appName}}
This is an automated message, please do not reply.`;
}

/**
 * Resend email provider
 */
export class ResendProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.resend.com';
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        const response = await fetch(`${this.baseUrl}/emails`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                subject,
                html,
                text,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            throw new Error(`Resend API error: ${response.status} - ${errorData.message || errorText}`);
        }
        
        return await response.json();
    }
}

/**
 * SendGrid email provider
 */
export class SendGridProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.sendgrid.com/v3';
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        const response = await fetch(`${this.baseUrl}/mail/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: to }]
                }],
                from: { email: from },
                subject: subject,
                content: [
                    { type: 'text/plain', value: text },
                    { type: 'text/html', value: html }
                ]
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
        }
        
        return { success: true };
    }
}

/**
 * Get email provider based on customer config or environment
 * @param {object|null} customer - Customer object
 * @param {*} env - Worker environment
 * @returns {ResendProvider|SendGridProvider} Email provider instance
 */
export function getEmailProvider(customer, env) {
    // Check customer-specific email provider config
    if (customer && customer.config && customer.config.emailProvider) {
        const providerConfig = customer.config.emailProvider;
        
        if (providerConfig.type === 'sendgrid' && providerConfig.apiKey) {
            return new SendGridProvider(providerConfig.apiKey);
        }
        
        if (providerConfig.type === 'resend' && providerConfig.apiKey) {
            return new ResendProvider(providerConfig.apiKey);
        }
    }
    
    // Default to Resend using environment variable
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured. Set it via: wrangler secret put RESEND_API_KEY');
    }
    
    return new ResendProvider(env.RESEND_API_KEY);
}

