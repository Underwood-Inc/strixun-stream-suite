/**
 * Email utilities
 * Template rendering, email providers, and sending logic
 */

// Cloudflare Workers: file system APIs are not available
// Always use inline template

/**
 * Escape HTML entities
 */
export function escapeHtml(str: string): string {
    if (!str) return '';
    const map: Record<string, string> = {
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
 */
export function renderEmailTemplate(template: string, variables: Record<string, string | number | null | undefined>, isHtml = false): string {
    if (!template) return '';
    
    let rendered = template;
    
    // Replace all variables (case-insensitive)
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        // For HTML templates, escape variables to prevent XSS (except for otp which is safe)
        // For text templates, use as-is
        const replacement = isHtml && key !== 'otp' ? escapeHtml(String(value || '')) : String(value || '');
        rendered = rendered.replace(regex, replacement);
    }
    
    return rendered;
}

let emailTemplateCache: string | null = null;

/**
 * Get default email template
 * Uses Strixun Stream Suite brand colors:
 * - Accent: #edae49 (golden yellow)
 * - Accent dark: #c68214
 * - Background: #1a1611 (dark brown)
 * - Card: #252017
 * - Text: #f9f9f9
 * - Text secondary: #b8b8b8
 */
export function getDefaultEmailTemplate(): string {
    if (emailTemplateCache === null) {
        // Always use inline template - file system not available in Workers
        emailTemplateCache = getInlineEmailTemplate();
    }
    return emailTemplateCache;
}

function getInlineEmailTemplate(): string {
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
            text-decoration: none;
        }
        .brand-name:hover {
            color: #c68214;
            text-decoration: underline;
        }
        .footer a {
            color: #edae49;
            text-decoration: none;
        }
        .footer a:hover {
            color: #c68214;
            text-decoration: underline;
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
                <p><a href="https://auth.idling.app" class="brand-name">{{appName}}</a></p>
                <p>{{footerText}}</p>
            </div>
        </div>
        {{trackingPixel}}
    </div>
</body>
</html>`;
}

/**
 * Get default text email template
 */
export function getDefaultTextTemplate(): string {
    return `Your Verification Code

Use this code to verify your email address: {{otp}}

This code will expire in {{expiresIn}} minutes.

If you didn't request this code, please ignore this email.

{{appName}}
This is an automated message, please do not reply.`;
}

export interface EmailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
}

export interface EmailProvider {
    sendEmail(options: EmailOptions): Promise<any>;
}

/**
 * Resend email provider
 * 
 * NOTE: This class must be exported as a named export to work correctly with Cloudflare Workers bundling.
 * Do not change to default export as it will break the constructor in the bundled output.
 */
export class ResendProvider implements EmailProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('ResendProvider requires an API key');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.resend.com';
    }
    
    async sendEmail({ from, to, subject, html, text }: EmailOptions): Promise<any> {
        try {
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
                let errorText = '';
                let errorData: { message?: string; error?: string; details?: any } = {};
                
                try {
                    errorText = await response.text();
                    if (errorText) {
                        try {
                            errorData = JSON.parse(errorText);
                        } catch (e) {
                            errorData = { message: errorText };
                        }
                    }
                } catch (readError) {
                    errorText = `Unable to read error response: ${readError instanceof Error ? readError.message : String(readError)}`;
                    errorData = { message: errorText };
                }
                
                // Extract error message from response (tries multiple fields, then throws)
                const errorMessage = errorData.message || errorData.error || errorText || `HTTP ${response.status} ${response.statusText}`;
                
                throw new Error(`Resend API error: ${response.status} - ${errorMessage}`);
            }
            
            return await response.json();
        } catch (error: any) {
            // Re-throw if it's already our formatted error
            if (error.message && error.message.includes('Resend API error:')) {
                throw error;
            }
            
            // Handle network errors, timeouts, etc.
            if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('network'))) {
                throw new Error(`Network error: Unable to connect to Resend API - ${error.message}`);
            } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
                throw new Error(`Timeout error: Resend API request timed out - ${error.message}`);
            } else {
                // Wrap other errors
                throw new Error(`Resend API error: ${error.message || 'Unknown error'}`);
            }
        }
    }
}

/**
 * SendGrid email provider
 */
export class SendGridProvider implements EmailProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error('SendGridProvider requires an API key');
        }
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.sendgrid.com/v3';
    }
    
    async sendEmail({ from, to, subject, html, text }: EmailOptions): Promise<{ success: boolean }> {
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

interface Customer {
    config?: {
        emailProvider?: {
            type: 'resend' | 'sendgrid';
            apiKey: string;
        };
    };
}

interface Env {
    RESEND_API_KEY?: string;
    [key: string]: any;
}

/**
 * Get email provider based on customer config or environment
 */
export function getEmailProvider(customer: Customer | null, env: Env): EmailProvider {
    // Runtime check to ensure ResendProvider is a constructor
    // This helps debug bundling issues where the class might be transformed incorrectly
    if (typeof ResendProvider !== 'function') {
        const errorMsg = `ResendProvider is not a constructor. Type: ${typeof ResendProvider}, Value: ${String(ResendProvider)}`;
        console.error('ResendProvider bundling error:', errorMsg);
        throw new Error(`Email provider initialization failed: ${errorMsg}`);
    }
    
    // Check customer-specific email provider config
    if (customer?.config?.emailProvider) {
        const providerConfig = customer.config.emailProvider;
        
        if (providerConfig.type === 'sendgrid' && providerConfig.apiKey) {
            if (typeof SendGridProvider !== 'function') {
                throw new Error('SendGridProvider is not a constructor. This is a bundling issue.');
            }
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

