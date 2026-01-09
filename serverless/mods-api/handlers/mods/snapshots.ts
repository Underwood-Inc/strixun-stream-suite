/**
 * Mod snapshots handler
 * GET /mods/:modId/snapshots - List snapshots for a mod
 * GET /mods/:modId/snapshots/:snapshotId - Load a specific snapshot
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { verifySnapshot } from '../../utils/snapshot.js';
import type { ModSnapshot } from '../../types/snapshot.js';

/**
 * List snapshots for a mod
 */
export async function handleListModSnapshots(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        if (!auth) {
            const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to view snapshots');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 401,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod to verify ownership
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as any;
        
        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check authorization - only mod author can view snapshots
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to view snapshots for this mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get snapshot list
        const snapshotsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_snapshots`);
        const snapshotIds = await env.MODS_KV.get(snapshotsListKey, { type: 'json' }) as string[] | null;
        
        if (!snapshotIds || snapshotIds.length === 0) {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify({ snapshots: [], total: 0 }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Load all snapshots
        const snapshots: ModSnapshot[] = [];
        for (const snapshotId of snapshotIds) {
            const snapshotKey = getCustomerKey(auth.customerId, `snapshot_${snapshotId}`);
            const snapshot = await env.MODS_KV.get(snapshotKey, { type: 'json' }) as ModSnapshot | null;
            if (snapshot) {
                // Verify snapshot integrity
                const isValid = await verifySnapshot(snapshot, env);
                if (isValid) {
                    snapshots.push(snapshot);
                } else {
                    console.warn(`[Snapshots] Invalid snapshot detected: ${snapshotId}`);
                }
            }
        }

        // Sort by creation date (newest first)
        snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ snapshots, total: snapshots.length }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('List mod snapshots error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Snapshots',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing snapshots'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
 * Load a specific snapshot
 */
export async function handleLoadSnapshot(
    request: Request,
    env: Env,
    modId: string,
    snapshotId: string,
    auth: { customerId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        if (!auth) {
            const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to load snapshots');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 401,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get snapshot
        const snapshotKey = getCustomerKey(auth.customerId, `snapshot_${snapshotId}`);
        const snapshot = await env.MODS_KV.get(snapshotKey, { type: 'json' }) as ModSnapshot | null;
        
        if (!snapshot) {
            const rfcError = createError(request, 404, 'Snapshot Not Found', 'The requested snapshot was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify snapshot belongs to the mod
        if (snapshot.modId !== normalizeModId(modId)) {
            const rfcError = createError(request, 400, 'Bad Request', 'Snapshot does not belong to the specified mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod to verify ownership
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as any;
        
        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check authorization - only mod author can load snapshots
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to load snapshots for this mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify snapshot integrity
        const isValid = await verifySnapshot(snapshot, env);
        if (!isValid) {
            const rfcError = createError(request, 400, 'Invalid Snapshot', 'Snapshot integrity verification failed');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ snapshot }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Load snapshot error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Load Snapshot',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while loading snapshot'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    FILE_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

