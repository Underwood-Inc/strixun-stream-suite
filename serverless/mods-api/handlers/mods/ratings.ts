/**
 * Handle mod ratings requests
 * GET /mods/:modId/ratings - Get ratings for a mod
 * POST /mods/:modId/ratings - Submit a rating for a mod
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModRating, ModRatingRequest, ModRatingsResponse } from '../../types/rating.js';

/**
 * Generate a unique rating ID
 */
function generateRatingId(): string {
    return `rating_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handle get mod ratings
 * GET /mods/:modId/ratings
 */
export async function handleGetModRatings(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes (for cross-customer access)
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
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
        
        // Check visibility and status - only show ratings for public/approved mods or if user owns the mod
        // Legacy mods without status field are treated as published
        const modVisibility = mod.visibility || 'public';
        const modStatus = mod.status || 'published';
        const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
        const isPublic = modVisibility === 'public';
        const isAuthor = auth && mod.authorId === auth.userId;
        
        // Allow if: (public AND approved/published) OR user is the author
        if (!isPublic || !isAllowedStatus) {
            if (!isAuthor) {
                const rfcError = createError(request, 403, 'Forbidden', 'Ratings are only available for published or approved public mods');
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
        }
        
        // Get ratings list key (use normalized modId from the found mod)
        const normalizedStoredModId = normalizeModId(mod.modId);
        const ratingsListKey = getCustomerKey(null, `mod_${normalizedStoredModId}_ratings`);
        const ratingsListJson = await env.MODS_KV.get(ratingsListKey, { type: 'json' }) as string[] | null;
        const ratingIds = ratingsListJson || [];
        
        // Fetch all ratings
        const ratings: ModRating[] = [];
        for (const ratingId of ratingIds) {
            const ratingKey = getCustomerKey(null, `rating_${ratingId}`);
            const rating = await env.MODS_KV.get(ratingKey, { type: 'json' }) as ModRating | null;
            if (rating) {
                ratings.push(rating);
            }
        }
        
        // Fetch missing display names for ratings that don't have userDisplayName
        // Similar to how mod detail handler fetches missing authorDisplayName
        const { fetchDisplayNameByUserId } = await import('../../utils/displayName.js');
        const ratingsNeedingDisplayName = ratings.filter(r => !r.userDisplayName && r.userId);
        
        if (ratingsNeedingDisplayName.length > 0) {
            // Fetch all missing display names in parallel for better performance
            const displayNamePromises = ratingsNeedingDisplayName.map(async (rating) => {
                const fetchedDisplayName = await fetchDisplayNameByUserId(rating.userId, env);
                return { rating, fetchedDisplayName };
            });
            
            const displayNameResults = await Promise.all(displayNamePromises);
            
            // Update ratings with fetched display names and prepare for storage update
            const ratingsToUpdate: ModRating[] = [];
            for (const { rating, fetchedDisplayName } of displayNameResults) {
                if (fetchedDisplayName) {
                    rating.userDisplayName = fetchedDisplayName;
                    ratingsToUpdate.push(rating);
                }
            }
            
            // Update ratings in storage if we fetched any missing display names
            // This ensures future requests don't need to fetch again
            if (ratingsToUpdate.length > 0) {
                const updatePromises = ratingsToUpdate.map(rating => {
                    const ratingKey = getCustomerKey(null, `rating_${rating.ratingId}`);
                    return env.MODS_KV.put(ratingKey, JSON.stringify(rating));
                });
                await Promise.all(updatePromises);
            }
        }
        
        // Sort by creation date (newest first)
        ratings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Calculate average rating
        const averageRating = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;
        
        const response: ModRatingsResponse = {
            ratings,
            averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
            totalRatings: ratings.length,
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
    } catch (error) {
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            'Failed to fetch mod ratings'
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
 * Handle submit mod rating
 * POST /mods/:modId/ratings
 */
export async function handleSubmitModRating(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Parse request body
        const body = await request.json() as ModRatingRequest;
        
        // Validate rating
        if (!body.rating || body.rating < 1 || body.rating > 5) {
            const rfcError = createError(request, 400, 'Invalid Rating', 'Rating must be between 1 and 5');
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

        // CRITICAL: Validate customerId is present - required for display name lookups
        if (!auth.customerId) {
            console.error('[Ratings] CRITICAL: customerId is null for authenticated user:', {
                userId: auth.userId,
                email: auth.email,
                note: 'Rejecting rating submission - customerId is required for display name lookups'
            });
            const rfcError = createError(request, 400, 'Missing Customer ID', 'Customer ID is required for rating submissions. Please ensure your account has a valid customer association.');
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
        
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first if authenticated
        if (auth.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes (for cross-customer access)
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
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
        
        // Check if mod can be rated (published or approved mods can be rated)
        // Legacy mods without status field are treated as published
        const modStatus = mod.status || 'published';
        const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
        if (!isAllowedStatus) {
            // Only allow rating if user is the author (authors can rate their own mods even if not published/approved)
            const isAuthor = mod.authorId === auth.userId;
            if (!isAuthor) {
                const rfcError = createError(request, 403, 'Forbidden', 'Only published or approved mods can be rated');
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
        }
        
        // CRITICAL: Get user displayName from customer data - customer is the source of truth
        let userDisplayName: string | null = null;
        
        if (auth.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/customer-lookup');
            userDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
            if (!userDisplayName) {
                console.warn('[Ratings] Could not fetch displayName from customer data:', {
                    customerId: auth.customerId,
                    userId: auth.userId
                });
            }
        } else {
            console.warn('[Ratings] Missing customerId, cannot fetch displayName from customer data:', {
                userId: auth.userId
            });
        }
        
        // Check if user has already rated this mod (use normalized modId from the found mod)
        const normalizedStoredModId = normalizeModId(mod.modId);
        const ratingsListKey = getCustomerKey(null, `mod_${normalizedStoredModId}_ratings`);
        const ratingsListJson = await env.MODS_KV.get(ratingsListKey, { type: 'json' }) as string[] | null;
        const ratingIds = ratingsListJson || [];
        
        // Check existing ratings for this user
        for (const ratingId of ratingIds) {
            const ratingKey = getCustomerKey(null, `rating_${ratingId}`);
            const existingRating = await env.MODS_KV.get(ratingKey, { type: 'json' }) as ModRating | null;
            if (existingRating && existingRating.userId === auth.userId) {
                // User has already rated - update existing rating
                // Allow comment to be cleared (empty string) or updated
                const updatedComment = body.comment !== undefined 
                    ? (body.comment || null) // Allow empty string to clear comment
                    : existingRating.comment; // Keep existing if not provided
                
                const updatedRating: ModRating = {
                    ...existingRating,
                    userDisplayName: userDisplayName || existingRating.userDisplayName || null,
                    rating: body.rating,
                    comment: updatedComment,
                    updatedAt: new Date().toISOString(),
                };
                
                await env.MODS_KV.put(ratingKey, JSON.stringify(updatedRating));
                
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                
                return new Response(JSON.stringify({ rating: updatedRating }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
        }
        
        // Create new rating
        const ratingId = generateRatingId();
        const now = new Date().toISOString();
        
        // CRITICAL: Never store email - email is ONLY for OTP authentication
        const rating: ModRating = {
            ratingId,
            modId: normalizedStoredModId, // Use normalized modId from the found mod
            userId: auth.userId, // userId from OTP auth service
            userDisplayName, // Display name fetched from /auth/me (never use email)
            rating: body.rating,
            comment: body.comment,
            createdAt: now,
        };
        
        // Store rating
        const ratingKey = getCustomerKey(null, `rating_${ratingId}`);
        await env.MODS_KV.put(ratingKey, JSON.stringify(rating));
        
        // Add to ratings list
        const updatedRatingsList = [...ratingIds, ratingId];
        await env.MODS_KV.put(ratingsListKey, JSON.stringify(updatedRatingsList));
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({ rating }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            'Failed to submit rating'
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

