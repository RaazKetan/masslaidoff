import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type {
  UserBlock,
  UserReport,
  ConsentRecord,
  AccountDeletionRequest,
  AuditEvent,
} from './types';

/**
 * Report a user or profile for suspicious/abusive behavior
 */
export async function reportUser(input: {
  reportedUserId?: string;
  reportType: string;
  details?: string;
}): Promise<UserReport> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before submitting a report.');

  const { data, error } = await client
    .from('user_reports')
    .insert({
      reporter_id: user.id,
      reported_user_id: input.reportedUserId || null,
      report_type: input.reportType,
      details: input.details || null,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Block another user (prevents seeing profile/requests)
 */
export async function blockUser(blockedId: string, reason?: string): Promise<UserBlock> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before blocking a user.');
  if (user.id === blockedId) throw new Error('Cannot block yourself.');

  const { data, error } = await client
    .from('user_blocks')
    .insert({
      blocker_id: user.id,
      blocked_id: blockedId,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Unblock a previously blocked user
 */
export async function unblockUser(blockedId: string): Promise<void> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to manage blocks.');

  const { error } = await client
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

/**
 * Get list of users blocked by the current user
 */
export async function getBlockedUsers(): Promise<UserBlock[]> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await client
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Submit an account deletion request
 */
export async function requestAccountDeletion(reason?: string): Promise<AccountDeletionRequest> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before requesting account deletion.');

  // Schedule deletion 30 days out per spec §16
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from('account_deletion_requests')
    .insert({
      user_id: user.id,
      reason: reason || null,
      status: 'scheduled',
      scheduled_for: scheduledFor,
    })
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent('account_deletion_requested', 'user_accounts', user.id, {
    reason,
    scheduled_for: scheduledFor,
  }).catch(() => {
    // Non-blocking audit log
  });

  return data;
}

/**
 * Cancel an active account deletion request
 */
export async function cancelAccountDeletion(): Promise<void> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to manage account deletion.');

  const { error } = await client
    .from('account_deletion_requests')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('status', 'scheduled');

  if (error) throw error;

  await logAuditEvent('account_deletion_cancelled', 'user_accounts', user.id).catch(() => {});
}

/**
 * Get the latest account deletion request status for the current user
 */
export async function getAccountDeletionStatus(): Promise<AccountDeletionRequest | null> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await client
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get active user consents
 */
export async function getUserConsents(): Promise<ConsentRecord[]> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await client
    .from('consent_records')
    .select('*')
    .eq('user_id', user.id)
    .order('granted_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Revoke a specific consent
 */
export async function revokeConsent(consentType: string): Promise<void> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to update consent.');

  const { error } = await client
    .from('consent_records')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('consent_type', consentType)
    .is('revoked_at', null);

  if (error) throw error;

  await logAuditEvent('consent_revoked', 'consent_records', undefined, { consent_type: consentType }).catch(() => {});
}

/**
 * Log a user audit event (for compliance & security)
 */
export async function logAuditEvent(
  action: string,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const client = requireSupabase();
  const user = await getCurrentUser();

  await client.from('audit_events').insert({
    user_id: user?.id ?? null,
    action,
    resource: resource || null,
    resource_id: resourceId || null,
    metadata: metadata || null,
  });
}

/**
 * Export all personal data as a portable JSON object (GDPR / Data Portability)
 */
export async function exportUserData(): Promise<Record<string, unknown>> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before exporting data.');

  // Fetch all user records concurrently
  const [
    accountRes,
    contactsRes,
    candidateRes,
    recruiterRes,
    reviewsRes,
    consentsRes,
  ] = await Promise.all([
    client.from('user_accounts').select('*').eq('id', user.id).maybeSingle(),
    client.from('private_contacts').select('*').eq('user_id', user.id).maybeSingle(),
    client.from('candidate_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    client.from('recruiter_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    client.from('manager_reviews').select('*').eq('author_id', user.id),
    client.from('consent_records').select('*').eq('user_id', user.id),
  ]);

  let candidateId = candidateRes.data?.id;
  let employments: unknown[] = [];
  let layoffRecords: unknown[] = [];
  let skills: unknown[] = [];
  let documentsMeta: unknown[] = [];

  if (candidateId) {
    const [empRes, layoffRes, skillsRes, docsRes] = await Promise.all([
      client.from('employments').select('*, employment_private_details(*)').eq('candidate_id', candidateId),
      client.from('layoff_records').select('*').eq('candidate_id', candidateId),
      client.from('candidate_skills').select('*, skills(name, slug, category)').eq('candidate_id', candidateId),
      client.from('candidate_documents').select('id, document_type, mime_type, file_size_bytes, verification_status, created_at').eq('candidate_id', candidateId).is('deleted_at', null),
    ]);
    employments = empRes.data ?? [];
    layoffRecords = layoffRes.data ?? [];
    skills = skillsRes.data ?? [];
    documentsMeta = docsRes.data ?? [];
  }

  await logAuditEvent('data_export_generated', 'user_accounts', user.id).catch(() => {});

  return {
    export_metadata: {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      schema_version: '1.0',
      system: 'MassLaidOff',
    },
    account: accountRes.data ?? null,
    contacts: contactsRes.data ?? null,
    candidate_profile: candidateRes.data ?? null,
    recruiter_profile: recruiterRes.data ?? null,
    employments,
    layoff_records: layoffRecords,
    skills,
    documents_metadata: documentsMeta,
    manager_reviews_authored: reviewsRes.data ?? [],
    consent_records: consentsRes.data ?? [],
  };
}
