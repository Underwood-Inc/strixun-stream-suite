/**
 * Mod Ratings Component
 * Public rating and review system for mods
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import type { ModRating } from '../../types/mod';
import styled from 'styled-components';
import { colors, spacing } from '../../theme';
import { getButtonStyles } from '../../utils/buttonStyles';

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

const Star = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'filled' && prop !== 'hovered' && prop !== 'dimmed',
})<{ filled: boolean; hovered?: boolean; dimmed?: boolean }>`
  color: ${props => {
    if (props.dimmed) return `${colors.accent}40`; // Dimmed filled stars (25% opacity)
    if (props.filled) return colors.accent;
    if (props.hovered) return `${colors.accent}80`; // Faded accent color (50% opacity)
    return colors.textMuted;
  }};
  font-size: 1.25rem;
  transition: color 0.2s ease;
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

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  ${({ $variant = 'primary' }) => getButtonStyles($variant)}
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
            stars.push(<Star key={i} filled={true}> ★ </Star>);
        } else if (i === fullStars && hasHalfStar) {
            stars.push(<Star key={i} filled={true}> ★ </Star>);
        } else {
            stars.push(<Star key={i} filled={false}> ★ </Star>);
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
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    // Calculate average rating if not provided
    const avgRating = averageRating || (ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0);
    
    const breakdown = calculateRatingBreakdown(ratings);
    const totalRatings = ratings.length;
    
    // Check if user has already rated
    const userRating = isAuthenticated && user 
        ? ratings.find(r => r.userId === user.userId)
        : null;
    
    // Initialize form with user's existing rating when entering edit mode
    const handleEditClick = () => {
        if (userRating) {
            setSelectedRating(userRating.rating);
            setComment(userRating.comment || '');
            setIsEditing(true);
        }
    };
    
    const handleCancelEdit = () => {
        setIsEditing(false);
        setSelectedRating(0);
        setComment('');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRating || !onRatingSubmit) return;
        
        // CRITICAL: Check for customerId - required for rating submission
        if (!user?.customerId) {
            alert('Your account is missing a customer association. This is required for rating submissions. Please contact support or try logging out and back in.');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onRatingSubmit(selectedRating, comment);
            setSelectedRating(0);
            setComment('');
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to submit rating:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                                        <RatingLabel>{star} ★ </RatingLabel>
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

            {isAuthenticated && (!userRating || isEditing) && onRatingSubmit && (
                <ReviewForm onSubmit={handleSubmit}>
                    <FormTitle>{isEditing ? 'Edit your review' : 'Rate this mod'}</FormTitle>
                    <RatingInput>
                        <span style={{ fontSize: '0.875rem', color: colors.text }}>Rating:</span>
                        {[1, 2, 3, 4, 5].map((rating) => {
                            const isFilled = rating <= selectedRating;
                            const isInHoverRange = rating <= hoveredRating && hoveredRating > 0;
                            const isHoveringLower = hoveredRating > 0 && hoveredRating < selectedRating;
                            
                            // Dim filled stars that are above the hovered rating when hovering lower than selected
                            const isDimmed = isFilled && isHoveringLower && rating > hoveredRating;
                            
                            // Show outlined hover style for stars in hover range
                            // If hovering lower than selected, show hover style even for filled stars in hover range
                            const showHovered = isInHoverRange && (!isFilled || isHoveringLower);
                            
                            // Determine if star should appear filled (not dimmed)
                            const shouldBeFilled = isFilled && !isDimmed && !showHovered;
                            
                            return (
                                <Star
                                    key={rating}
                                    filled={shouldBeFilled}
                                    hovered={showHovered}
                                    dimmed={isDimmed}
                                    onClick={() => setSelectedRating(rating)}
                                    onMouseEnter={() => setHoveredRating(rating)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    style={{ cursor: 'pointer', fontSize: '1.5rem' }}
                                >
                                    {shouldBeFilled ? ' ★ ' : (showHovered ? ' ☆ ' : ' ★ ')}
                                </Star>
                            );
                        })}
                    </RatingInput>
                    <TextArea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Write a review (optional)..."
                    />
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                        <Button
                            type="submit"
                            $variant="primary"
                            disabled={!selectedRating || isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : (isEditing ? 'Update Review' : 'Submit Rating')}
                        </Button>
                        {isEditing && (
                            <Button 
                                type="button" 
                                $variant="secondary"
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </ReviewForm>
            )}

            {!isAuthenticated && (
                <AuthPrompt>
                    <Link to="/login" style={{ color: colors.accent, textDecoration: 'none' }}>Log in</Link> to rate and review this mod
                </AuthPrompt>
            )}

            {userRating && !isEditing && (
                <div style={{ padding: spacing.md, background: colors.bgTertiary, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                        <div style={{ fontSize: '0.875rem', color: colors.textSecondary }}>
                            Your rating:
                        </div>
                        {onRatingSubmit && (
                            <Button 
                                type="button"
                                $variant="secondary"
                                onClick={handleEditClick}
                                style={{ fontSize: '0.875rem', padding: `${spacing.xs} ${spacing.sm}` }}
                            >
                                Edit
                            </Button>
                        )}
                    </div>
                    <ReviewRating>{renderStars(userRating.rating)}</ReviewRating>
                    {userRating.comment && (
                        <ReviewContent>{userRating.comment}</ReviewContent>
                    )}
                    {userRating.updatedAt && userRating.updatedAt !== userRating.createdAt && (
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: spacing.xs }}>
                            Updated: {new Date(userRating.updatedAt).toLocaleDateString()}
                        </div>
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

