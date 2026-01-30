/**
 * Handle mod ratings requests
 * GET /mods/:modId/ratings
 * POST /mods/:modId/ratings
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    getExistingEntities,
    putEntity,
    indexGet,
    indexAdd,
    canAccessVisible,
} from '@strixun/kv-entities';
import type { ModRating, ModRatingRequest, ModRatingsResponse } from '../../types/rating.js';
import type { Env } from '../../worker.js';
import type { ModMetadata } from '../../types/mod.js';

function generateRatingId(): string {
    return `rating_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export async function handleGetModRatings(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };
        if (!canAccessVisible(modForAccess, { customerId: auth?.customerId || null, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'Ratings are only available for published or approved public mods');
        }

        const ratingIds = await indexGet(env.MODS_KV, 'mods', 'ratings-for', modId);
        const ratings = await getExistingEntities<ModRating>(env.MODS_KV, 'mods', 'rating', ratingIds);

        // Fetch missing display names
        const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
        const ratingsNeedingDisplayName = ratings.filter(r => !r.customerDisplayName && r.customerId);

        for (const rating of ratingsNeedingDisplayName) {
            const displayName = await fetchDisplayNameByCustomerId(rating.customerId, env);
            if (displayName) {
                rating.customerDisplayName = displayName;
                await putEntity(env.MODS_KV, 'mods', 'rating', rating.ratingId, rating);
            }
        }

        ratings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const averageRating = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;

        const response: ModRatingsResponse = {
            ratings,
            averageRating: Math.round(averageRating * 10) / 10,
            totalRatings: ratings.length,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error) {
        return errorResponse(request, env, 500, 'Internal Server Error', 'Failed to fetch mod ratings');
    }
}

export async function handleSubmitModRating(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        const body = await request.json() as ModRatingRequest;

        if (!body.rating || body.rating < 1 || body.rating > 5) {
            return errorResponse(request, env, 400, 'Invalid Rating', 'Rating must be between 1 and 5');
        }

        if (!auth.customerId) {
            return errorResponse(request, env, 400, 'Missing Customer ID', 'Customer ID is required');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const modStatus = mod.status || 'published';
        const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
        const isAuthor = mod.authorId === auth.customerId;

        if (!isAllowedStatus && !isAuthor) {
            return errorResponse(request, env, 403, 'Forbidden', 'Only published or approved mods can be rated');
        }

        const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
        const customerDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);

        const ratingIds = await indexGet(env.MODS_KV, 'mods', 'ratings-for', modId);
        const existingRatings = await getExistingEntities<ModRating>(env.MODS_KV, 'mods', 'rating', ratingIds);

        const existingRating = existingRatings.find(r => r.customerId === auth.customerId);

        if (existingRating) {
            const updatedRating: ModRating = {
                ...existingRating,
                customerDisplayName: customerDisplayName || existingRating.customerDisplayName || null,
                rating: body.rating,
                comment: body.comment !== undefined ? (body.comment || undefined) : existingRating.comment,
                updatedAt: new Date().toISOString(),
            };

            await putEntity(env.MODS_KV, 'mods', 'rating', existingRating.ratingId, updatedRating);

            return new Response(JSON.stringify({ rating: updatedRating }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
            });
        }

        const ratingId = generateRatingId();
        const now = new Date().toISOString();

        const rating: ModRating = {
            ratingId,
            modId,
            customerId: auth.customerId,
            customerDisplayName,
            rating: body.rating,
            comment: body.comment,
            createdAt: now,
        };

        await putEntity(env.MODS_KV, 'mods', 'rating', ratingId, rating);
        await indexAdd(env.MODS_KV, 'mods', 'ratings-for', modId, ratingId);

        return new Response(JSON.stringify({ rating }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error) {
        return errorResponse(request, env, 500, 'Internal Server Error', 'Failed to submit rating');
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
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
