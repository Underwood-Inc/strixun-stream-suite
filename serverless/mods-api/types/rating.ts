/**
 * Mod rating types
 */

export interface ModRating {
    ratingId: string;
    modId: string;
    customerId: string; // DEPRECATED: Use customerId instead (kept for backward compatibility with existing data)
    customerId?: string; // Customer ID from OTP auth service (preferred)
    userDisplayName?: string | null; // Display name (never use email)
    rating: number; // 1-5
    comment?: string;
    createdAt: string;
    updatedAt?: string;
    // CRITICAL: userEmail is NOT stored - email is ONLY for OTP authentication
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

