/**
 * Mod rating types
 */

export interface ModRating {
    ratingId: string;
    modId: string;
    customerId: string; // Customer ID from OTP auth service (REQUIRED)
    customerDisplayName?: string | null; // Display name (never use email)
    rating: number; // 1-5
    comment?: string;
    createdAt: string;
    updatedAt?: string;
    // CRITICAL: customerEmail is NOT stored - email is ONLY for OTP authentication
}

export interface ModRatingRequest {
    rating: number; // 1-5
    comment?: string;
}

export interface ModRatingsResponse {
    ratings: ModRating[];
    averageRating: number;
    totalRatings: number;
}

