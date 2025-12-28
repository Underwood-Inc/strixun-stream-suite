/**
 * Mod rating types
 */

export interface ModRating {
    ratingId: string;
    modId: string;
    userId: string; // User ID from OTP auth service
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

