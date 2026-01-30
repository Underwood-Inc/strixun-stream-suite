/**
 * Mod snapshots handler
 * GET /mods/:modId/snapshots
 * GET /mods/:modId/snapshots/:snapshotId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    getExistingEntities,
    indexGet,
    canModify,
} from '@strixun/kv-entities';
import { verifySnapshot } from '../../utils/snapshot.js';
import type { ModSnapshot } from '../../types/snapshot.js';
import type { ModMetadata } from '../../types/mod.js';

export async function handleListModSnapshots(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        if (!auth) {
            return errorResponse(request, env, 401, 'Unauthorized', 'Authentication required to view snapshots');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to view snapshots');
        }

        const snapshotIds = await indexGet(env.MODS_KV, 'mods', 'snapshots-for', modId);

        if (snapshotIds.length === 0) {
            return new Response(JSON.stringify({ snapshots: [], total: 0 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
            });
        }

        const allSnapshots = await getExistingEntities<ModSnapshot>(env.MODS_KV, 'mods', 'snapshot', snapshotIds);

        // Verify and filter
        const snapshots: ModSnapshot[] = [];
        for (const snapshot of allSnapshots) {
            const isValid = await verifySnapshot(snapshot, env);
            if (isValid) {
                snapshots.push(snapshot);
            }
        }

        snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return new Response(JSON.stringify({ snapshots, total: snapshots.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('List mod snapshots error:', error);
        return errorResponse(
            request, env, 500, 'Failed to List Snapshots',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

export async function handleLoadSnapshot(
    request: Request,
    env: Env,
    modId: string,
    snapshotId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        if (!auth) {
            return errorResponse(request, env, 401, 'Unauthorized', 'Authentication required to load snapshots');
        }

        const snapshot = await getEntity<ModSnapshot>(env.MODS_KV, 'mods', 'snapshot', snapshotId);

        if (!snapshot) {
            return errorResponse(request, env, 404, 'Snapshot Not Found', 'The requested snapshot was not found');
        }

        if (snapshot.modId !== modId) {
            return errorResponse(request, env, 400, 'Bad Request', 'Snapshot does not belong to the specified mod');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to load snapshots');
        }

        const isValid = await verifySnapshot(snapshot, env);
        if (!isValid) {
            return errorResponse(request, env, 400, 'Invalid Snapshot', 'Snapshot integrity verification failed');
        }

        return new Response(JSON.stringify({ snapshot }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Load snapshot error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Load Snapshot',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
    });
}

interface Env {
    MODS_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    FILE_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}
