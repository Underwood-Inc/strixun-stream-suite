/**
 * Admin customer mods handlers
 * Handles fetching mods by customer (author) ID
 * 
 * NOTE: This is MOD data, not customer data, so it belongs in mods-api
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Handle get customer's mods request (admin only)
 * GET /admin/customers/:customerId/mods
 * 
 * Fetches all mods created by a specific customer (by authorId)
 */
export async function handleGetCustomerMods(
    request: Request,
    env: Env,
    customerId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        
        const customerMods: ModMetadata[] = [];
        
        // Get all mod IDs from all scopes
        const allModIds = new Set<string>();
        const modIdToCustomerId = new Map<string, string | null>();
        
        // Get global public list
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        if (globalListData) {
            globalListData.forEach(id => {
                allModIds.add(id);
                modIdToCustomerId.set(id, null);
            });
        }
        
        // Get mods from all customer scopes
        const customerListPrefix = 'customer_';
        let cursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
            
            for (const key of listResult.keys) {
                if (key.name.endsWith('_mods_list')) {
                    const customerListData = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                    if (customerListData && Array.isArray(customerListData)) {
                        const scopeCustomerId = key.name.replace('customer_', '').replace('_mods_list', '');
                        customerListData.forEach(id => {
                            allModIds.add(id);
                            modIdToCustomerId.set(id, scopeCustomerId);
                        });
                    }
                }
            }
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Fetch mod metadata for all mods and filter by authorId
        const { normalizeModId } = await import('../../utils/customer.js');
        
        for (const modId of allModIds) {
            const normalizedModId = normalizeModId(modId);
            let mod: ModMetadata | null = null;
            
            // Try global scope first
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found, try customer scope
            if (!mod) {
                const scopeCustomerId = modIdToCustomerId.get(modId);
                if (scopeCustomerId) {
                    const customerModKey = getCustomerKey(scopeCustomerId, `mod_${normalizedModId}`);
                    mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                }
            }
            
            // Filter by authorId
            if (mod && mod.authorId === customerId) {
                customerMods.push(mod);
            }
        }
        
        // Sort by updatedAt (newest first)
        customerMods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        // Paginate
        const total = customerMods.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedMods = customerMods.slice(start, end);
        
        const response = {
            mods: paginatedMods,
            total,
            page,
            pageSize,
        };
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin get customer mods error:', error);
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            'Failed to get customer mods'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
