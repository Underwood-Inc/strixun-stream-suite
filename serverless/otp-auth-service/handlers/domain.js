/**
 * Domain Verification Handlers
 * Handles domain verification endpoints for email sending
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../utils/cors.js';
import { generateVerificationToken } from '../utils/validation.js';
import { getCustomer, storeCustomer } from '../services/customer.js';

/**
 * Verify domain via DNS lookup
 * @param {string} domain - Domain to verify
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} True if verified
 */
export async function verifyDomainDNS(domain, token) {
    try {
        // Use Cloudflare's DNS-over-HTTPS API
        const dnsQuery = `_otpauth-verify.${domain}`;
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;
        
        const response = await fetch(dohUrl, {
            headers: {
                'Accept': 'application/dns-json'
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // Check if TXT record exists and contains token
        if (data.Answer && Array.isArray(data.Answer)) {
            for (const answer of data.Answer) {
                if (answer.type === 16 && answer.data) {
                    // TXT record data is in quotes, remove them
                    const recordValue = answer.data.replace(/^"|"$/g, '');
                    if (recordValue === token) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('DNS verification error:', error);
        return false;
    }
}

/**
 * Request domain verification
 * POST /admin/domains/verify
 */
export async function handleRequestDomainVerification(request, env, customerId) {
    try {
        const body = await request.json();
        const { domain } = body;
        
        if (!domain || !/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(domain)) {
            return new Response(JSON.stringify({ error: 'Valid domain name required' }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate verification token
        const token = generateVerificationToken();
        
        // Store verification record
        const domainKey = `domain_${domain}`;
        const verificationData = {
            domain,
            customerId,
            token,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };
        
        await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData), { expirationTtl: 604800 }); // 7 days
        
        // DNS record instructions
        const dnsRecord = {
            type: 'TXT',
            name: `_otpauth-verify.${domain}`,
            value: token,
            ttl: 3600
        };
        
        return new Response(JSON.stringify({
            success: true,
            domain,
            status: 'pending',
            dnsRecord,
            instructions: `Add a TXT record to your DNS with name "_otpauth-verify.${domain}" and value "${token}". Then call POST /admin/domains/${domain}/verify to check verification.`
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to request domain verification',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Check domain verification status
 * GET /admin/domains/{domain}/status
 */
export async function handleGetDomainStatus(request, env, domain) {
    try {
        const domainKey = `domain_${domain}`;
        const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: 'json' });
        
        if (!verificationData) {
            return new Response(JSON.stringify({ 
                error: 'Domain verification not found',
                domain,
                status: 'not_started'
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            domain: verificationData.domain,
            status: verificationData.status,
            createdAt: verificationData.createdAt,
            verifiedAt: verificationData.verifiedAt || null,
            expiresAt: verificationData.expiresAt
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get domain status',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Verify domain (check DNS and update status)
 * POST /admin/domains/{domain}/verify
 */
export async function handleVerifyDomain(request, env, customerId, domain) {
    try {
        const domainKey = `domain_${domain}`;
        const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: 'json' });
        
        if (!verificationData) {
            return new Response(JSON.stringify({ 
                error: 'Domain verification not found. Request verification first.',
                domain
            }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify customer owns this domain
        if (verificationData.customerId !== customerId) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if already verified
        if (verificationData.status === 'verified') {
            return new Response(JSON.stringify({
                success: true,
                domain,
                status: 'verified',
                verifiedAt: verificationData.verifiedAt,
                message: 'Domain is already verified'
            }), {
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(verificationData.expiresAt) < new Date()) {
            return new Response(JSON.stringify({
                error: 'Verification expired. Please request a new verification.',
                domain
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify DNS record
        const isVerified = await verifyDomainDNS(domain, verificationData.token);
        
        if (isVerified) {
            // Update verification status
            verificationData.status = 'verified';
            verificationData.verifiedAt = new Date().toISOString();
            await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData));
            
            // Update customer email config to use verified domain
            const customer = await getCustomer(customerId, env);
            if (customer) {
                if (!customer.config) customer.config = {};
                if (!customer.config.emailConfig) customer.config.emailConfig = {};
                
                // Set fromEmail if not already set
                if (!customer.config.emailConfig.fromEmail) {
                    customer.config.emailConfig.fromEmail = `noreply@${domain}`;
                }
                
                await storeCustomer(customerId, customer, env);
            }
            
            return new Response(JSON.stringify({
                success: true,
                domain,
                status: 'verified',
                verifiedAt: verificationData.verifiedAt,
                message: 'Domain verified successfully'
            }), {
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                domain,
                status: 'pending',
                message: 'DNS record not found or token mismatch. Please check your DNS configuration.'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to verify domain',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

