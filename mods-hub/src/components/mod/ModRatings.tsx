/**
 * Mod Ratings Component
 * Public rating and review system for mods
 */

import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import type { ModRating } from '../../types/mod';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';

const Container = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const RatingSummary = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
`;

const AverageRating = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const RatingValue = styled.div`
  font-size: 3rem;
  font-weight: 700;
  color: ${colors.accent};
  line-height: 1;
`;

const RatingStars = styled.div`
  display: flex;
  gap: ${spacing.xs};
  margin-top: ${spacing.xs};
`;

const Star = styled.span<{ filled: boolean }>`
  color: ${props => props.filled ? colors.accent : colors.textMuted};
  font-size: 1.25rem;
`;

const RatingCount = styled.div`
  font-size: 0.875rem;
  color: ${colors.textSecondary};
`;

const RatingBreakdown = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`;

const RatingBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const RatingLabel = styled.span`
  font-size: 0.875rem;
  color: ${colors.text};
  min-width: 60px;
`;

const BarContainer = styled.div`
  flex: 1;
  height: 8px;
  background: ${colors.bgTertiary};
  border-radius: 4px;
  overflow: hidden;
`;

const BarFill = styled.div<{ percentage: number }>`
  height: 100%;
  background: ${colors.accent};
  width: ${props => props.percentage}%;
  transition: width 0.3s ease;
`;

const ReviewsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Review = styled.div`
  padding: ${spacing.md};
  background: ${colors.bgTertiary};
  border-radius: 8px;
  border-left: 3px solid ${colors.border};
`;

const ReviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${spacing.sm};
`;

const ReviewAuthor = styled.span`
  font-weight: 600;
  color: ${colors.text};
  font-size: 0.875rem;
`;

const ReviewDate = styled.span`
  font-size: 0.75rem;
  color: ${colors.textMuted};
`;

const ReviewRating = styled.div`
  display: flex;
  gap: ${spacing.xs};
  margin-bottom: ${spacing.xs};
`;

const ReviewContent = styled.p`
  color: ${colors.textSecondary};
  line-height: 1.6;
  margin: 0;
  font-size: 0.875rem;
`;

const ReviewForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
  padding: ${spacing.md};
  background: ${colors.bgTertiary};
  border-radius: 8px;
`;

const FormTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${colors.text};
  margin: 0;
`;

const RatingInput = styled.div`
  display: flex;
  gap: ${spacing.xs};
  align-items: center;
`;

const TextArea = styled.textarea`
  padding: ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-family: inherit;
  font-size: 0.875rem;
  min-height: 100px;
  resize: vertical;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${spacing.sm} ${spacing.md};
  background: ${props => props.variant === 'primary' ? colors.accent : colors.bgSecondary};
  color: ${props => props.variant === 'primary' ? colors.bg : colors.text};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AuthPrompt = styled.div`
  text-align: center;
  padding: ${spacing.lg};
  color: ${colors.textSecondary};
  font-size: 0.875rem;
`;

interface ModRatingsProps {
    modId: string; // Required to associate ratings with the mod (used for API calls)
    ratings?: ModRating[]; // Ratings for this mod (fetched via GET /mods/:modId/ratings)
    averageRating?: number; // Pre-calculated average (optional, will calculate from ratings if not provided)
    onRatingSubmit?: (rating: number, comment: string) => Promise<void>; // Callback receives rating/comment, parent provides modId
}

function renderStars(rating: number) {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars.push(<Star key={i} filled={true}>★</Star>);
        } else if (i === fullStars && hasHalfStar) {
            stars.push(<Star key={i} filled={true}>★</Star>);
        } else {
            stars.push(<Star key={i} filled={false}>★</Star>);
        }
    }
    
    return <RatingStars>{stars}</RatingStars>;
}

function calculateRatingBreakdown(ratings: ModRating[]): number[] {
    const breakdown = [0, 0, 0, 0, 0]; // 5, 4, 3, 2, 1
    ratings.forEach(r => {
        if (r.rating >= 1 && r.rating <= 5) {
            breakdown[5 - r.rating]++;
        }
    });
    return breakdown;
}

export function ModRatings({ modId: _modId, ratings = [], averageRating, onRatingSubmit }: ModRatingsProps) {
    const { isAuthenticated, user } = useAuthStore();
    const [selectedRating, setSelectedRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Calculate average rating if not provided
    const avgRating = averageRating || (ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0);
    
    const breakdown = calculateRatingBreakdown(ratings);
    const totalRatings = ratings.length;
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRating || !onRatingSubmit) return;
        
        setIsSubmitting(true);
        try {
            await onRatingSubmit(selectedRating, comment);
            setSelectedRating(0);
            setComment('');
        } catch (error) {
            console.error('Failed to submit rating:', error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Check if user has already rated
    const userRating = isAuthenticated && user 
        ? ratings.find(r => r.userId === user.userId)
        : null;

    return (
        <Container>
            <Title>Ratings & Reviews</Title>
            
            {totalRatings > 0 ? (
                <>
                    <RatingSummary>
                        <AverageRating>
                            <RatingValue>{avgRating.toFixed(1)}</RatingValue>
                            {renderStars(avgRating)}
                            <RatingCount>{totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}</RatingCount>
                        </AverageRating>
                        <RatingBreakdown>
                            {[5, 4, 3, 2, 1].map((star, index) => {
                                const count = breakdown[index];
                                const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                                return (
                                    <RatingBar key={star}>
                                        <RatingLabel>{star}★</RatingLabel>
                                        <BarContainer>
                                            <BarFill percentage={percentage} />
                                        </BarContainer>
                                        <RatingCount>{count}</RatingCount>
                                    </RatingBar>
                                );
                            })}
                        </RatingBreakdown>
                    </RatingSummary>
                </>
            ) : (
                <div style={{ textAlign: 'center', padding: spacing.lg, color: colors.textSecondary }}>
                    No ratings yet. Be the first to rate this mod!
                </div>
            )}

            {isAuthenticated && !userRating && onRatingSubmit && (
                <ReviewForm onSubmit={handleSubmit}>
                    <FormTitle>Rate this mod</FormTitle>
                    <RatingInput>
                        <span style={{ fontSize: '0.875rem', color: colors.text }}>Rating:</span>
                        {[1, 2, 3, 4, 5].map((rating) => (
                            <Star
                                key={rating}
                                filled={rating <= selectedRating}
                                onClick={() => setSelectedRating(rating)}
                                style={{ cursor: 'pointer', fontSize: '1.5rem' }}
                            >
                                ★
                            </Star>
                        ))}
                    </RatingInput>
                    <TextArea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Write a review (optional)..."
                    />
                    <Button 
                        type="submit" 
                        variant="primary"
                        disabled={!selectedRating || isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Rating'}
                    </Button>
                </ReviewForm>
            )}

            {!isAuthenticated && (
                <AuthPrompt>
                    <a href="/login" style={{ color: colors.accent }}>Log in</a> to rate and review this mod
                </AuthPrompt>
            )}

            {userRating && (
                <div style={{ padding: spacing.md, background: colors.bgTertiary, borderRadius: 8 }}>
                    <div style={{ fontSize: '0.875rem', color: colors.textSecondary, marginBottom: spacing.xs }}>
                        Your rating:
                    </div>
                    <ReviewRating>{renderStars(userRating.rating)}</ReviewRating>
                    {userRating.comment && (
                        <ReviewContent>{userRating.comment}</ReviewContent>
                    )}
                </div>
            )}

            {ratings.length > 0 && (
                <ReviewsList>
                    <Title style={{ fontSize: '1rem' }}>Recent Reviews</Title>
                    {ratings.slice(0, 10).map((rating) => (
                        <Review key={rating.ratingId}>
                            <ReviewHeader>
                                <ReviewAuthor>{rating.userDisplayName || 'Unknown User'}</ReviewAuthor>
                                <ReviewDate>{new Date(rating.createdAt).toLocaleDateString()}</ReviewDate>
                            </ReviewHeader>
                            <ReviewRating>{renderStars(rating.rating)}</ReviewRating>
                            {rating.comment && (
                                <ReviewContent>{rating.comment}</ReviewContent>
                            )}
                        </Review>
                    ))}
                </ReviewsList>
            )}
        </Container>
    );
}

