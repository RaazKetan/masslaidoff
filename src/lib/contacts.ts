import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type { ContactRequest, ContactGrant, ContactRequestStatus } from './types';

/** Send a contact request to a candidate (recruiter action) */
export async function sendContactRequest(
  candidateId: string,
  message: string,
): Promise<ContactRequest> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before requesting contact.');

  // Set expiry to 14 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const { data, error } = await client
    .from('contact_requests')
    .insert({
      recruiter_id: user.id,
      candidate_id: candidateId,
      message,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Respond to a contact request (candidate action) */
export async function respondToContactRequest(
  requestId: string,
  status: 'accepted' | 'declined',
  grantedFields?: string[],
): Promise<void> {
  const client = requireSupabase();

  // Update the request status
  const { error: updateError } = await client
    .from('contact_requests')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (updateError) throw updateError;

  // If accepted, create a contact grant
  if (status === 'accepted' && grantedFields?.length) {
    const { data: request } = await client
      .from('contact_requests')
      .select('candidate_id, recruiter_id')
      .eq('id', requestId)
      .single();

    if (request) {
      // Grant expires in 90 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      const { error: grantError } = await client
        .from('contact_grants')
        .insert({
          contact_request_id: requestId,
          candidate_id: request.candidate_id,
          recruiter_id: request.recruiter_id,
          granted_fields: grantedFields,
          expires_at: expiresAt.toISOString(),
        });
      if (grantError) throw grantError;
    }
  }
}

/** Get contact requests for the current user (as candidate or recruiter) */
export async function getContactRequests(
  role: 'candidate' | 'recruiter',
  statusFilter?: ContactRequestStatus,
): Promise<ContactRequest[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  let query = requireSupabase()
    .from('contact_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (role === 'recruiter') {
    query = query.eq('recruiter_id', user.id);
  }
  // For candidates, RLS handles filtering via candidate_id ownership

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Get active contact grants for a specific recruiter/candidate pair */
export async function getActiveGrants(
  candidateId: string,
  recruiterId: string,
): Promise<ContactGrant[]> {
  const { data, error } = await requireSupabase()
    .from('contact_grants')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('recruiter_id', recruiterId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data ?? [];
}

/** Revoke a contact grant (candidate action) */
export async function revokeContactGrant(grantId: string) {
  const { error } = await requireSupabase()
    .from('contact_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', grantId);
  if (error) throw error;
}
