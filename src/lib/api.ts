import { supabase } from "./supabase";
import type { AccountType, DirectoryCandidate, LayoffCategory } from "./types";

const apiURL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8080"
).replace(/\/$/, "");

type Envelope<T> = { data: T; request_id: string };
type ErrorEnvelope = { error?: { code?: string; message?: string } };

export class APIError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch(`${apiURL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as Envelope<T> &
    ErrorEnvelope;
  if (!response.ok)
    throw new APIError(
      body.error?.message || "The API request failed.",
      body.error?.code || "request_failed",
      response.status,
    );
  return body.data;
}

export type Me = {
  id: string;
  email: string;
  account_type: Exclude<AccountType, "admin">;
  full_name: string;
  linkedin_url: string | null;
  company_email: string | null;
  company_email_verified: boolean;
};

export type CandidateProfilePayload = {
  full_name: string;
  linkedin_url: string;
  location: string;
  availability: string;
  years_experience: number;
  intro: string;
  company: string;
  role: string;
  org_name: string;
  team_name: string;
  started_on: string;
  ended_on: string;
  phone: string;
  contact_visibility: string;
  resume_visibility: string;
  public_stats_consent: boolean;
};

export type ReviewEligibility = {
  profile_exists: boolean;
  company_email_verified: boolean;
  evidence_uploaded: boolean;
  eligible: boolean;
};

export type BackendReview = {
  id: string;
  manager_name: string;
  company_name: string;
  relationship: string;
  rating: number;
  average_rating: number;
  leadership_rating: number;
  communication_rating: number;
  fairness_rating: number;
  career_growth_rating: number;
  review_title: string;
  review_body: string;
  published_at: string | null;
};

export type CandidateBackendProfile = {
  id: string;
  headline: string;
  location: string;
  years_experience: number;
  summary: string;
  available_from: string | null;
  available_now: boolean;
  contact_visibility: "request_access" | "verified_recruiters" | "hidden";
  resume_visibility: "request_access" | "verified_recruiters" | "hidden";
  company: string | null;
  role_title: string | null;
  org_name: string | null;
  team_name: string | null;
  started_on: string | null;
  ended_on: string | null;
  verification_status: string;
  phone_number: string | null;
  has_resume: boolean;
  public_stats_consent: boolean;
};

export type RecruiterCandidateDetail = {
  id: string;
  full_name: string;
  linkedin_url: string | null;
  headline: string;
  summary: string;
  location: string;
  years_experience: number;
  available_from: string | null;
  available_now: boolean;
  company: string | null;
  role_title: string | null;
  org_name: string | null;
  team_name: string | null;
  started_on: string | null;
  ended_on: string | null;
  contact_visibility: "request_access" | "verified_recruiters" | "hidden";
  resume_visibility: "request_access" | "verified_recruiters" | "hidden";
  has_resume: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  resume_access: boolean;
  request_status: string | null;
};

export type AccessRequest = {
  id: string;
  message: string;
  created_at: string;
  expires_at: string;
  status: string;
  recruiter_name: string;
  recruiter_company: string;
  recruiter_title: string;
};

export type PublicLayoffStats = {
  people_represented: number;
  companies_represented: number;
  minimum_cohort: number;
  companies: Array<{ company: string; people: number }>;
};

export async function getPublicLayoffStats(): Promise<PublicLayoffStats> {
  const response = await fetch(`${apiURL}/v1/public/layoffs`);
  const body = (await response.json().catch(() => ({}))) as Envelope<PublicLayoffStats> & ErrorEnvelope;
  if (!response.ok) throw new APIError(body.error?.message || "Statistics are unavailable.", body.error?.code || "request_failed", response.status);
  return body.data;
}

export type OutreachRequest = {
  id: string;
  candidate_id: string;
  candidate_name: string;
  headline: string;
  message: string;
  created_at: string;
  responded_at: string | null;
  status: "pending" | "accepted" | "declined" | "expired";
};

export type ResumeDocument = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  signed_url: string;
  expires_in: number;
};
export type CandidateDocument = Omit<ResumeDocument, "signed_url" | "expires_in"> & { document_type: "resume" | "exit_letter" | "salary_slip" | "other_employment_proof" };
export type CandidateReview = {
  id: string;
  manager_name: string;
  manager_linkedin_url: string;
  company: string;
  relationship: string;
  rating: number;
  leadership_rating: number;
  communication_rating: number;
  fairness_rating: number;
  career_growth_rating: number;
  review_title: string;
  review_body: string;
  status: "pending" | "published" | "rejected";
  published_at: string | null;
  created_at: string;
};
export type RecruiterBackendProfile = {
  company: string;
  title: string | null;
  work_email: string;
  linkedin_url: string | null;
  verification_status: string;
  verified_at: string | null;
};

export const api = {
  getMe: () => request<Me>("/v1/me"),
  onboard: (accountType: "candidate" | "recruiter", fullName: string) =>
    request("/v1/onboarding", {
      method: "POST",
      body: JSON.stringify({ account_type: accountType, full_name: fullName }),
    }),
  getCandidateProfile: () =>
    request<CandidateBackendProfile>("/v1/candidate/me"),
  getReviewEligibility: () =>
    request<ReviewEligibility>("/v1/candidate/me/review-eligibility"),
  getMyResume: () => request<ResumeDocument>("/v1/candidate/me/resume"),
  listMyDocuments: () => request<CandidateDocument[]>("/v1/candidate/me/documents"),
  deleteMyDocument: (id: string) => request(`/v1/candidate/me/documents/${encodeURIComponent(id)}`, { method: "DELETE" }),
  listMyReviews: () => request<CandidateReview[]>("/v1/candidate/me/reviews"),
  updateMyReview: (id: string, payload: Record<string, unknown>) => request(`/v1/candidate/me/reviews/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMyReview: (id: string) => request(`/v1/candidate/me/reviews/${encodeURIComponent(id)}`, { method: "DELETE" }),
  deleteAccount: (confirmation: string) => request<{ deleted: boolean }>("/v1/me", { method: "DELETE", body: JSON.stringify({ confirmation }) }),
  listAccessRequests: () => request<AccessRequest[]>("/v1/candidate/me/access-requests"),
  decideAccessRequest: (id: string, decision: "accepted" | "declined") =>
    request(`/v1/candidate/me/access-requests/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ decision }) }),
  saveCandidateProfile: (payload: CandidateProfilePayload) =>
    request<{ id: string; employment_id: string }>("/v1/candidate/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  getRecruiterProfile: () =>
    request<RecruiterBackendProfile>("/v1/recruiter/me"),
  saveRecruiterProfile: (payload: {
    full_name: string;
    linkedin_url: string;
    company: string;
    job_title: string;
    work_email: string;
  }) =>
    request("/v1/recruiter/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  listCandidates: async (
    query: string,
    discipline: string,
  ): Promise<DirectoryCandidate[]> => {
    const params = new URLSearchParams({ query, discipline, limit: "50" });
    const rows = await request<Array<Record<string, unknown>>>(
      `/v1/recruiter/candidates?${params}`,
    );
    return rows.map((row, index) => ({
      id: String(row.id),
      name: String(row.full_name),
      role: String(row.headline),
      company: String(row.latest_company || "Private company"),
      location: String(row.location),
      years: Number(row.years_experience),
      discipline: String(row.discipline || "Other"),
      remote: Boolean(row.open_to_remote),
      immediate: Boolean(row.available_now),
      skills: [],
      summary: String(row.short_intro || ""),
      color: (["rose", "slate", "sand", "lilac"] as const)[index % 4],
      prev: String(row.previous_role || ""),
      period: String(row.latest_period || ""),
      verified: row.verification_status === "verified",
      hasResume: Boolean(row.has_resume),
      contactMode: String(
        row.contact_visibility,
      ) as DirectoryCandidate["contactMode"],
      resumeMode: String(
        row.resume_visibility,
      ) as DirectoryCandidate["resumeMode"],
      layoffCategory: row.layoff_category
        ? (String(row.layoff_category) as LayoffCategory)
        : null,
      avatarPath: null,
      contactEmail: row.contact_email ? String(row.contact_email) : null,
      contactPhone: row.contact_phone ? String(row.contact_phone) : null,
      linkedinUrl: row.linkedin_url ? String(row.linkedin_url) : null,
      profileUrl: `/app/discover/${String(row.id)}`,
    }));
  },
  getRecruiterCandidate: (id: string) => request<RecruiterCandidateDetail>(`/v1/recruiter/candidates/${encodeURIComponent(id)}`),
  listMyOutreach: () => request<OutreachRequest[]>("/v1/recruiter/me/access-requests"),
  getRecruiterResume: (id: string) => request<ResumeDocument>(`/v1/recruiter/candidates/${encodeURIComponent(id)}/resume`),
  requestCandidateAccess: (id: string, message: string) =>
    request(`/v1/recruiter/candidates/${encodeURIComponent(id)}/access-requests`, { method: "POST", body: JSON.stringify({ message }) }),
  listReviews: (query: string) =>
    request<BackendReview[]>(
      `/v1/reviews?${new URLSearchParams({ query, limit: "50" })}`,
    ),
  submitReview: (payload: Record<string, unknown>) =>
    request("/v1/candidate/me/reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadDocument: (documentType: string, file: File) => {
    const body = new FormData();
    body.append("document_type", documentType);
    body.append("file", file);
    return request("/v1/candidate/me/documents", { method: "POST", body });
  },
  requestCompanyEmailVerification: (email: string) =>
    request<{
      sent: boolean;
      expires_at: string;
      development_verification_url?: string;
    }>("/v1/me/company-email/challenge", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  confirmCompanyEmail: (token: string) =>
    request<{ verified: boolean; company_email: string }>(
      "/v1/me/company-email/confirm",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      },
    ),
};
