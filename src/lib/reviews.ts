import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type { ManagerReview, PublicManagerReviewRow } from './types';

/** Submit a manager review with structured ratings */
export async function submitReview(input: {
  managerName: string;
  managerLinkedinUrl: string;
  company: string;
  employmentId?: string;
  relationship: string;
  rating: number;
  leadershipRating: number;
  communicationRating: number;
  fairnessRating: number;
  careerGrowthRating: number;
  reviewTitle?: string;
  reviewBody: string;
}): Promise<ManagerReview> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before submitting a review.');

  const { data, error } = await client
    .from('manager_reviews')
    .insert({
      author_id: user.id,
      manager_name: input.managerName,
      manager_linkedin_url: input.managerLinkedinUrl,
      company: input.company,
      employment_id: input.employmentId || null,
      relationship: input.relationship,
      rating: input.rating,
      leadership_rating: input.leadershipRating,
      communication_rating: input.communicationRating,
      fairness_rating: input.fairnessRating,
      career_growth_rating: input.careerGrowthRating,
      review_title: input.reviewTitle || null,
      review: input.reviewBody,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get published manager reviews (public view) */
export async function getPublishedReviews(
  companyFilter?: string,
  limit = 20,
): Promise<PublicManagerReviewRow[]> {
  let query = requireSupabase()
    .from('public_manager_reviews')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (companyFilter) {
    query = query.eq('company_name', companyFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Get reviews authored by the current user */
export async function getMyReviews(): Promise<ManagerReview[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await requireSupabase()
    .from('manager_reviews')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Report a published review */
export async function reportReview(reviewId: string, reason: string, details?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to report a review.');

  const { error } = await requireSupabase()
    .from('review_reports')
    .insert({
      review_id: reviewId,
      reported_by_user_id: user.id,
      reason,
      details: details || null,
    });
  if (error) throw error;
}

/** Compute the average of the four structured ratings */
export function averageRating(review: {
  leadership_rating?: number | null;
  communication_rating?: number | null;
  fairness_rating?: number | null;
  career_growth_rating?: number | null;
}): number {
  const ratings = [
    review.leadership_rating,
    review.communication_rating,
    review.fairness_rating,
    review.career_growth_rating,
  ].filter((r): r is number => r != null);
  if (!ratings.length) return 0;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}
