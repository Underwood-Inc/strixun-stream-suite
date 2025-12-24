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

/**
 * Get default email template
 * @returns {string} Default HTML template
 */
export function getDefaultEmailTemplate() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .otp-code { 
                    font-size: 32px; 
                    font-weight: bold; 
                    letter-spacing: 8px; 
                    text-align: center;
                    background: #f4f4f4;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-family: monospace;
                }
                .footer { 
                    margin-top: 30px; 
                    font-size: 12px; 
                    color: #666; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Your Verification Code</h1>
                <p>Use this code to verify your email address:</p>
                <div class="otp-code">{{otp}}</div>
                <p>This code will expire in <strong>{{expiresIn}} minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>{{appName}}</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
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

