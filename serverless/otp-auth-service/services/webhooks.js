/**
 * Webhook service
 * Webhook signing and delivery
 */

import { getCustomer } from './customer.js';

/**
 * Sign webhook payload
 * @param {object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {Promise<string>} HMAC-SHA256 signature
 */
export async function signWebhook(payload, secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const keyData = encoder.encode(secret);
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send webhook event
 * @param {string} customerId - Customer ID
 * @param {string} event - Event type
 * @param {object} data - Event data
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function sendWebhook(customerId, event, data, env) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer || !customer.config || !customer.config.webhookConfig) {
            return; // No webhook configured
        }
        
        const webhookConfig = customer.config.webhookConfig;
        if (!webhookConfig.url) {
            return; // No webhook URL
        }
        
        // Check if event is subscribed
        if (webhookConfig.events && webhookConfig.events.length > 0) {
            if (!webhookConfig.events.includes(event) && !webhookConfig.events.includes('*')) {
                return; // Event not subscribed
            }
        }
        
        // Build payload
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            customerId,
            data
        };
        
        // Sign payload
        const signature = webhookConfig.secret 
            ? await signWebhook(payload, webhookConfig.secret)
            : null;
        
        // Send webhook
        const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-Event': event,
                'X-OTP-Timestamp': payload.timestamp,
                ...(signature && { 'X-OTP-Signature': signature })
            },
            body: JSON.stringify(payload)
        });
        
        // Log result
        if (!response.ok) {
            console.error('Webhook delivery failed:', {
                customerId,
                event,
                url: webhookConfig.url,
                status: response.status,
                statusText: response.statusText
            });
            
            // Store failed webhook for retry (simplified - would use queue in production)
            const retryKey = `webhook_retry_${customerId}_${Date.now()}`;
            await env.OTP_AUTH_KV.put(retryKey, JSON.stringify({
                customerId,
                event,
                data,
                url: webhookConfig.url,
                attempts: 1,
                nextRetry: new Date(Date.now() + 60000).toISOString() // 1 minute
            }), { expirationTtl: 86400 }); // 24 hours
        } else {
            console.log('Webhook delivered successfully:', { customerId, event });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        // Don't throw - webhooks shouldn't break the main flow
    }
}

