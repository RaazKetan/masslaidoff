// =============================================================================
// MassLaidOff - shared frontend types
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type AccountType = "candidate" | "recruiter" | "admin";
export type ContactMode = "verified_recruiters" | "request_access" | "hidden";
export type LayoffCategory =
  "individual" | "team" | "division" | "company_wide" | "undisclosed";
export type DocumentType =
  "resume" | "exit_letter" | "salary_slip" | "other_employment_proof";

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

/** Display-ready candidate for the directory list */
export interface DirectoryCandidate {
  id: string;
  profileUrl?: string;
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
  color: "rose" | "slate" | "sand" | "lilac";
  prev: string;
  period: string;
  verified: boolean;
  hasResume: boolean;
  contactMode: ContactMode;
  resumeMode: ContactMode;
  layoffCategory: LayoffCategory | null;
  avatarPath: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl?: string | null;
}
