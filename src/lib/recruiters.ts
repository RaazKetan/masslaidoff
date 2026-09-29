import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type { RecruiterProfile, ShortlistEntry } from './types';

/** Create or update the recruiter profile */
export async function saveRecruiterProfile(input: {
  company: string;
  title: string;
  workEmail: string;
  linkedinUrl?: string;
  companyId?: string;
}): Promise<RecruiterProfile> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before creating a recruiter profile.');

  const { data, error } = await client
    .from('recruiter_profiles')
    .upsert({
      user_id: user.id,
      full_name: (await client.from('user_accounts').select('full_name').eq('id', user.id).single()).data?.full_name ?? '',
      company: input.company,
      title: input.title || null,
      work_email: input.workEmail,
      linkedin_url: input.linkedinUrl || null,
      company_id: input.companyId || null,
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get the current user's recruiter profile */
export async function getRecruiterProfile(): Promise<RecruiterProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await requireSupabase()
    .from('recruiter_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
}

/** Save a candidate to the shortlist with an optional private note */
export async function saveToShortlist(candidateId: string, privateNote?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to save candidates.');

  const { error } = await requireSupabase()
    .from('shortlist_entries')
    .upsert({
      recruiter_id: user.id,
      candidate_id: candidateId,
      private_note: privateNote || null,
    }, { onConflict: 'recruiter_id,candidate_id' });
  if (error) throw error;
}

/** Remove a candidate from the shortlist */
export async function removeFromShortlist(candidateId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to manage your shortlist.');

  const { error } = await requireSupabase()
    .from('shortlist_entries')
    .delete()
    .eq('recruiter_id', user.id)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}

/** Get all shortlist entries for the current recruiter */
export async function getShortlist(): Promise<ShortlistEntry[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await requireSupabase()
    .from('shortlist_entries')
    .select('*')
    .eq('recruiter_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Update the private note on a shortlist entry */
export async function updateShortlistNote(candidateId: string, privateNote: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to update notes.');

  const { error } = await requireSupabase()
    .from('shortlist_entries')
    .update({ private_note: privateNote })
    .eq('recruiter_id', user.id)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}

/** Record a candidate profile view (audit) */
export async function recordCandidateView(candidateId: string, context?: string) {
  const user = await getCurrentUser();
  if (!user) return;

  await requireSupabase()
    .from('candidate_views')
    .insert({
      candidate_id: candidateId,
      recruiter_id: user.id,
      access_context: context || 'profile_view',
    });
}
