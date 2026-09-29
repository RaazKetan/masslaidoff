// =============================================================================
// MassLaidOff — TypeScript types for all database entities
// Mirrors the schema defined in PRODUCT_SPEC.md §9–10
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type AccountType = 'candidate' | 'recruiter' | 'admin';
export type ProfileVisibility = 'private' | 'published' | 'paused';
export type ContactMode = 'verified_recruiters' | 'request_access' | 'hidden';
export type LayoffCategory = 'individual' | 'team' | 'division' | 'company_wide' | 'undisclosed';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type DocumentType = 'resume' | 'exit_letter' | 'salary_slip' | 'other_employment_proof';
export type DocVerifyStatus = 'not_required' | 'pending' | 'verified' | 'rejected';
export type ContactRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
export type PreferredContact = 'email' | 'phone' | 'either';
export type ReviewStatus = 'pending' | 'published' | 'rejected';
export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export type DeletionStatus = 'requested' | 'scheduled' | 'completed' | 'cancelled';

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------
export interface UserAccount {
  id: string;
  account_type: AccountType;
  full_name: string;
  avatar_path: string | null;
  linkedin_url: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivateContacts {
  user_id: string;
  personal_email: string | null;
  personal_email_verified_at: string | null;
  company_email: string | null;
  company_email_verified_at: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  phone_verified_at: string | null;
  preferred_contact_method: PreferredContact;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  headline: string;
  discipline: string;
  primary_role: string | null;
  location: string;
  years_experience: number;
  summary: string | null;
  skills: string[];
  open_to_remote: boolean;
  available_from: string | null;
  preferred_locations: string[] | null;
  industry: string | null;
  visibility: ProfileVisibility;
  contact_visibility: ContactMode;
  resume_visibility: ContactMode;
  verification_status: VerificationStatus;
  profile_completion: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  linkedin_url: string | null;
  logo_url: string | null;
  industry: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  approved: boolean;
}

export interface CandidateSkill {
  candidate_id: string;
  skill_id: string;
  years_experience: number | null;
  display_order: number;
}

// ---------------------------------------------------------------------------
// Employment
// ---------------------------------------------------------------------------
export interface Employment {
  id: string;
  candidate_id: string;
  company_id: string | null;
  company: string;
  role_title: string;
  org_name: string | null;
  team_name: string | null;
  location: string | null;
  started_on: string | null;
  ended_on: string | null;
  is_latest: boolean;
  short_description: string | null;
  created_at: string;
}

export interface EmploymentPrivateDetails {
  employment_id: string;
  manager_name: string | null;
  manager_linkedin_url: string | null;
  internal_org_details: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoffRecord {
  id: string;
  candidate_id: string;
  employment_id: string;
  layoff_date: string | null;
  last_working_date: string | null;
  layoff_category: LayoffCategory;
  verification_status: VerificationStatus;
  verified_at: string | null;
  public_stats_consent: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: DocumentType;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  verification_status: DocVerifyStatus;
  uploaded_at: string;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Recruiter
// ---------------------------------------------------------------------------
export interface RecruiterProfile {
  id?: string;
  user_id: string;
  company_id: string | null;
  company: string;
  full_name: string;
  title: string | null;
  work_email: string;
  linkedin_url: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  created_at: string;
}

export interface ShortlistEntry {
  recruiter_id: string;
  candidate_id: string;
  private_note: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Contact flow
// ---------------------------------------------------------------------------
export interface ContactRequest {
  id: string;
  recruiter_id: string;
  candidate_id: string;
  message: string;
  status: ContactRequestStatus;
  responded_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactGrant {
  id: string;
  contact_request_id: string;
  candidate_id: string;
  recruiter_id: string;
  granted_fields: string[];
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export interface ManagerReview {
  id: string;
  author_id: string;
  employment_id: string | null;
  company: string;
  manager_name: string;
  manager_linkedin_url: string;
  relationship: string;
  rating: number;
  leadership_rating: number | null;
  communication_rating: number | null;
  fairness_rating: number | null;
  career_growth_rating: number | null;
  review_title: string | null;
  review: string;
  status: ReviewStatus;
  moderation_notes: string | null;
  published_at: string | null;
  created_at: string;
}

export interface ReviewReport {
  id: string;
  review_id: string;
  reported_by_user_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------
export interface VerificationRequest {
  id: string;
  user_id: string;
  verification_type: 'employment' | 'layoff' | 'recruiter_company';
  status: VerificationStatus;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface VerificationEvidence {
  id: string;
  verification_request_id: string;
  document_id: string | null;
  evidence_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Public metrics
// ---------------------------------------------------------------------------
export interface PublicMetricsDaily {
  id: string;
  metric_date: string;
  company_id: string | null;
  published_candidates: number;
  verified_candidates: number;
  new_profiles: number;
  companies_represented: number;
  profiles_by_role: Record<string, number> | null;
  profiles_by_location: Record<string, number> | null;
}

// ---------------------------------------------------------------------------
// Safety & moderation
// ---------------------------------------------------------------------------
export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  report_type: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  policy_version: string;
  granted_at: string;
  revoked_at: string | null;
}

export interface AuditEvent {
  id: string;
  user_id: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AccountDeletionRequest {
  id: string;
  user_id: string;
  reason: string | null;
  status: DeletionStatus;
  scheduled_for: string | null;
  completed_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// View types (safe projections)
// ---------------------------------------------------------------------------
export interface CandidateDirectoryRow {
  id: string;
  user_id: string;
  full_name: string;
  headline: string;
  discipline: string;
  primary_role: string | null;
  location: string;
  years_experience: number;
  short_intro: string | null;
  open_to_remote: boolean;
  available_from: string | null;
  preferred_locations: string[] | null;
  industry: string | null;
  verification_status: VerificationStatus;
  profile_completion: number;
  contact_visibility: ContactMode;
  resume_visibility: ContactMode;
  published_at: string | null;
  avatar_path: string | null;
  latest_company: string | null;
  previous_role: string | null;
  latest_period: string | null;
  layoff_date: string | null;
  last_working_date: string | null;
  layoff_category: LayoffCategory | null;
}

export interface CandidateRecruiterDetailRow extends CandidateDirectoryRow {
  skill_names: string[];
  employment_history: EmploymentHistoryItem[];
  has_resume: boolean;
}

export interface EmploymentHistoryItem {
  id: string;
  company: string;
  role: string;
  org_name: string | null;
  team_name: string | null;
  location: string | null;
  started_on: string | null;
  ended_on: string | null;
  description: string | null;
  is_latest: boolean;
}

export interface PublicManagerReviewRow {
  id: string;
  manager_name: string;
  company_name: string | null;
  relationship: string;
  rating: number;
  leadership_rating: number | null;
  communication_rating: number | null;
  fairness_rating: number | null;
  career_growth_rating: number | null;
  review_title: string | null;
  review_body: string;
  published_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// UI helper types
// ---------------------------------------------------------------------------

/** Display-ready candidate for the directory list */
export interface DirectoryCandidate {
  id: string;
  name: string;
  role: string;
  company: string;
  location: string;
  years: number;
  discipline: string;
  remote: boolean;
  immediate: boolean;
  skills: string[];
  summary: string;
  color: 'rose' | 'slate' | 'sand' | 'lilac';
  prev: string;
  period: string;
  verified: boolean;
  hasResume: boolean;
  contactMode: ContactMode;
  resumeMode: ContactMode;
  layoffCategory: LayoffCategory | null;
  avatarPath: string | null;
}

/** Form values for candidate profile builder */
export interface CandidateFormValues {
  name: string;
  headline: string;
  primaryRole: string;
  location: string;
  yearsExperience: number;
  summary: string;
  skills: string[];
  openToRemote: boolean;
  availableFrom: string;
  preferredLocations: string[];
  industry: string;
  discipline: string;

  // Employment
  latestCompany: string;
  latestRole: string;
  latestStartDate: string;
  latestEndDate: string;
  orgName: string;
  teamName: string;
  shortDescription: string;

  // Layoff
  layoffDate: string;
  lastWorkingDate: string;
  layoffCategory: LayoffCategory;

  // Manager (private)
  managerName: string;
  managerLinkedin: string;

  // Contact
  personalEmail: string;
  phone: string;
  phoneCountryCode: string;
  companyEmail: string;
  contactVisibility: ContactMode;
  resumeVisibility: ContactMode;
  preferredContactMethod: PreferredContact;

  // Consent
  privacyConsent: boolean;
  statsConsent: boolean;
}

/** Form values for recruiter profile */
export interface RecruiterFormValues {
  name: string;
  company: string;
  title: string;
  workEmail: string;
  linkedinUrl: string;
}
