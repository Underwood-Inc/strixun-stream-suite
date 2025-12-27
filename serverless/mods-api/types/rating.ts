/**
 * Mod rating types
 */

export interface ModRating {
    ratingId: string;
    modId: string;
    userId: string;
    userEmail: string;
    rating: number; // 1-5
    comment?: string;
    createdAt: string;
    updatedAt?: string;
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

