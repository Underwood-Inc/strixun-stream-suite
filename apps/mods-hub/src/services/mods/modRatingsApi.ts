/**
 * Mod Ratings API
 * Handles mod rating operations: get ratings, submit rating
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { ModRating } from '../../types/mod';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * Get mod ratings
 */
export async function getModRatings(modId: string): Promise<{
    ratings: ModRating[];
    average: number;
    total: number;
}> {
    try {
        const response = await api.get<{
            ratings: ModRating[];
            average: number;
            total: number;
        }>(`/mods/${modId}/ratings`);
        return response.data;
    } catch (error) {
        console.error(`[ModRatingsAPI] Failed to get ratings for mod ${modId}:`, error);
        throw new Error(`Failed to get mod ratings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Submit mod rating (requires authentication)
 */
export async function submitModRating(
    modId: string,
    rating: number,
    comment?: string
): Promise<ModRating> {
    try {
        const response = await api.post<ModRating>(`/mods/${modId}/ratings`, { rating, comment });
        return response.data;
    } catch (error) {
        console.error(`[ModRatingsAPI] Failed to submit rating for mod ${modId}:`, error);
        throw new Error(`Failed to submit rating: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
