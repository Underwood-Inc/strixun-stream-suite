/**
 * Admin approval handler
 * Handles customer upload approval/revocation
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { createAccessClient } from '../../../shared/access-client.js';

/**
 * Approve customer for uploads
 * POST /admin/approvals/:customerId
 */
export async function handleApproveCustomer(
    request: Request,
    env: Env,
    customerId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        // Route-level protection ensures customer is super admin
        // Add 'uploader' role to customer via Access Service
        // Extract JWT token from auth object or from cookie
        let jwtToken: string | null = null;
        if (auth.jwtToken) {
            jwtToken = auth.jwtToken;
        } else {
            // Fallback: extract from cookie if not in auth object
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) {
                    jwtToken = authCookie.substring('auth_token='.length).trim();
                }
            }
        }
        const access = createAccessClient(env, { jwtToken: jwtToken || undefined });
        const authorization = await access.getCustomerAuthorization(customerId);
        
        if (!authorization) {
            throw new Error('Customer not found in Access Service');
        }
        
        // Add 'uploader' role if not already present
        const updatedRoles = authorization.roles.includes('uploader')
            ? authorization.roles
            : [...authorization.roles, 'uploader'];
        
        // Note: This would require an admin endpoint in Access Service
        // For now, this is a placeholder - the actual implementation would call:
        // await fetch(`${ACCESS_URL}/access/${customerId}/roles`, { method: 'PUT', body: JSON.stringify({ roles: updatedRoles }) })
        
        console.log('[Admin] Customer approval via Authorization Service:', { customerId, roles: updatedRoles });

        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, customerId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Approve customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Approve Customer',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while approving customer'
        );
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Revoke customer upload permission
 * DELETE /admin/approvals/:customerId
 */
export async function handleRevokeCustomer(
    request: Request,
    env: Env,
    customerId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        // Route-level protection ensures customer is super admin
        // Remove 'uploader' role from customer via Access Service
        // Extract JWT token from auth object or from cookie
        let jwtToken: string | null = null;
        if (auth.jwtToken) {
            jwtToken = auth.jwtToken;
        } else {
            // Fallback: extract from cookie if not in auth object
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) {
                    jwtToken = authCookie.substring('auth_token='.length).trim();
                }
            }
        }
        const access = createAccessClient(env, { jwtToken: jwtToken || undefined });
        const authorization = await access.getCustomerAuthorization(customerId);
        
        if (!authorization) {
            throw new Error('Customer not found in Access Service');
        }
        
        // Remove 'uploader' role if present
        const updatedRoles = authorization.roles.filter(r => r !== 'uploader');
        
        // Note: This would require an admin endpoint in Access Service
        // For now, this is a placeholder - the actual implementation would call:
        // await fetch(`${ACCESS_URL}/access/${customerId}/roles`, { method: 'PUT', body: JSON.stringify({ roles: updatedRoles }) })
        
        console.log('[Admin] Customer revocation via Authorization Service:', { customerId, roles: updatedRoles });

        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true, customerId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Revoke customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Revoke Customer',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while revoking customer'
        );
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * List approved uploaders
 * GET /admin/approvals
 */
export async function handleListApprovedUsers(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Query Access Service for all customers with 'uploader' role
        // Note: This requires an admin query endpoint in Access Service
        // For now, return empty array as placeholder
        const approvedUsers: string[] = [];
        console.log('[Admin] List approved uploaders - Access Service query needed');

        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ approvedUsers }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('List approved users error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Approved Users',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing approved users'
        );
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

