import { requireSupabase } from './supabase';
import { getCurrentUser } from './auth';
import type {
  CandidateProfile,
  CandidateDirectoryRow,
  DirectoryCandidate,
  ContactMode,
  LayoffCategory,
  Employment,
  LayoffRecord,
} from './types';

// ---------------------------------------------------------------------------
// Directory (public search)
// ---------------------------------------------------------------------------

/** Fetch published candidates from the safe candidate_directory view */
export async function listCandidates(): Promise<DirectoryCandidate[]> {
  const { data, error } = await requireSupabase()
    .from('candidate_directory')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: CandidateDirectoryRow, index: number) => ({
    id: row.id,
    name: row.full_name,
    role: row.headline,
    company: row.latest_company ?? 'Private company',
    location: row.location,
    years: row.years_experience,
    discipline: row.discipline ?? 'Other',
    remote: row.open_to_remote,
    immediate: row.available_from
      ? new Date(row.available_from) <= new Date()
      : false,
    skills: [], // Skills loaded separately via candidate_recruiter_detail
    summary: row.short_intro ?? '',
    color: (['rose', 'slate', 'sand', 'lilac'] as const)[index % 4],
    prev: row.previous_role ?? '',
    period: row.latest_period ?? '',
    verified: row.verification_status === 'verified',
    hasResume: false,
    contactMode: row.contact_visibility,
    resumeMode: row.resume_visibility,
    layoffCategory: row.layoff_category ?? null,
    avatarPath: row.avatar_path ?? null,
  }));
}

/** Fetch a single candidate with full recruiter-visible detail */
export async function getCandidateDetail(candidateId: string) {
  const { data, error } = await requireSupabase()
    .from('candidate_recruiter_detail')
    .select('*')
    .eq('id', candidateId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Candidate profile CRUD
// ---------------------------------------------------------------------------

/** Get the current user's candidate profile */
export async function getMyProfile(): Promise<CandidateProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data } = await requireSupabase()
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return data;
}

/** Save or update the candidate profile */
export async function saveCandidateProfile(input: {
  headline: string;
  primaryRole?: string;
  location: string;
  yearsExperience: number;
  summary: string;
  skills: string[];
  discipline?: string;
  openToRemote: boolean;
  availableFrom?: string;
  preferredLocations?: string[];
  industry?: string;
  contactVisibility: ContactMode;
  resumeVisibility: ContactMode;
}): Promise<CandidateProfile> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in before saving a profile.');

  const { data, error } = await client
    .from('candidate_profiles')
    .upsert({
      user_id: user.id,
      headline: input.headline,
      primary_role: input.primaryRole || input.headline,
      location: input.location,
      years_experience: input.yearsExperience,
      summary: input.summary,
      skills: input.skills,
      discipline: input.discipline || 'Other',
      open_to_remote: input.openToRemote,
      available_from: input.availableFrom || null,
      preferred_locations: input.preferredLocations || null,
      industry: input.industry || null,
      contact_visibility: input.contactVisibility,
      resume_visibility: input.resumeVisibility,
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Publish the profile */
export async function publishProfile(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const { error } = await requireSupabase()
    .from('candidate_profiles')
    .update({
      visibility: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
  if (error) throw error;
}

/** Pause the profile (hide from directory but keep data) */
export async function pauseProfile(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const { error } = await requireSupabase()
    .from('candidate_profiles')
    .update({ visibility: 'paused' })
    .eq('user_id', user.id);
  if (error) throw error;
}

/** Unpublish the profile (set to private) */
export async function unpublishProfile(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in.');

  const { error } = await requireSupabase()
    .from('candidate_profiles')
    .update({ visibility: 'private' })
    .eq('user_id', user.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Employment records
// ---------------------------------------------------------------------------

/** Get all employments for a candidate */
export async function getEmployments(candidateId: string): Promise<Employment[]> {
  const { data, error } = await requireSupabase()
    .from('employments')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('is_latest', { ascending: false })
    .order('ended_on', { ascending: false, nullsFirst: true });
  if (error) throw error;
  return data ?? [];
}

/** Save an employment record */
export async function saveEmployment(input: {
  candidateId: string;
  company: string;
  companyId?: string;
  roleTitle: string;
  orgName?: string;
  teamName?: string;
  location?: string;
  startedOn?: string;
  endedOn?: string;
  isLatest: boolean;
  shortDescription?: string;
}): Promise<Employment> {
  const { data, error } = await requireSupabase()
    .from('employments')
    .insert({
      candidate_id: input.candidateId,
      company: input.company,
      company_id: input.companyId || null,
      role_title: input.roleTitle,
      org_name: input.orgName || null,
      team_name: input.teamName || null,
      location: input.location || null,
      started_on: input.startedOn || null,
      ended_on: input.endedOn || null,
      is_latest: input.isLatest,
      short_description: input.shortDescription || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Save employment private details (manager info) */
export async function saveEmploymentPrivateDetails(input: {
  employmentId: string;
  managerName?: string;
  managerLinkedinUrl?: string;
  internalOrgDetails?: string;
}) {
  const { error } = await requireSupabase()
    .from('employment_private_details')
    .upsert({
      employment_id: input.employmentId,
      manager_name: input.managerName || null,
      manager_linkedin_url: input.managerLinkedinUrl || null,
      internal_org_details: input.internalOrgDetails || null,
    }, { onConflict: 'employment_id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Layoff records
// ---------------------------------------------------------------------------

/** Save a layoff record */
export async function saveLayoffRecord(input: {
  candidateId: string;
  employmentId: string;
  layoffDate?: string;
  lastWorkingDate?: string;
  layoffCategory: LayoffCategory;
  publicStatsConsent: boolean;
}): Promise<LayoffRecord> {
  const { data, error } = await requireSupabase()
    .from('layoff_records')
    .upsert({
      candidate_id: input.candidateId,
      employment_id: input.employmentId,
      layoff_date: input.layoffDate || null,
      last_working_date: input.lastWorkingDate || null,
      layoff_category: input.layoffCategory,
      public_stats_consent: input.publicStatsConsent,
    }, { onConflict: 'candidate_id,employment_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get layoff records for a candidate */
export async function getLayoffRecords(candidateId: string): Promise<LayoffRecord[]> {
  const { data, error } = await requireSupabase()
    .from('layoff_records')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

/** Search available skills */
export async function searchSkills(query: string) {
  if (!query || query.length < 1) return [];
  const { data, error } = await requireSupabase()
    .from('skills')
    .select('*')
    .eq('approved', true)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

/** Get all skills for a candidate */
export async function getCandidateSkills(candidateId: string) {
  const { data, error } = await requireSupabase()
    .from('candidate_skills')
    .select('*, skills(name, slug, category)')
    .eq('candidate_id', candidateId)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

/** Set skills for a candidate (replace all) */
export async function setCandidateSkills(
  candidateId: string,
  skillIds: string[],
) {
  const client = requireSupabase();

  // Remove existing
  await client
    .from('candidate_skills')
    .delete()
    .eq('candidate_id', candidateId);

  // Insert new
  if (skillIds.length) {
    const { error } = await client
      .from('candidate_skills')
      .insert(
        skillIds.map((skillId, i) => ({
          candidate_id: candidateId,
          skill_id: skillId,
          display_order: i,
        })),
      );
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible sign-in (used by existing workspace.js)
// ---------------------------------------------------------------------------
export { signInWithEmail } from './auth';
