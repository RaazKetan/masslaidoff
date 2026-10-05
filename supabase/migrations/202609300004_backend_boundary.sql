-- MassLaidOff backend boundary and company email verification.
-- The browser authenticates with Supabase Auth, but all application data moves
-- through the Go API. Verification tokens are stored only as SHA-256 hashes.

create table if not exists public.company_email_challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_accounts(id) on delete cascade,
  email       citext not null,
  token_hash  text not null unique check (char_length(token_hash) = 64),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists company_email_challenges_user_active_idx
  on public.company_email_challenges (user_id, expires_at desc)
  where consumed_at is null;

alter table public.company_email_challenges enable row level security;

-- No browser policy is intentionally created for challenge records.
revoke all on public.company_email_challenges from public, anon, authenticated;

-- Supabase Auth remains browser-accessible. Application tables and safe views
-- are backend-only so UI code cannot bypass authorization or validation.
revoke all on public.user_accounts from anon, authenticated;
revoke all on public.private_contacts from anon, authenticated;
revoke all on public.candidate_profiles from anon, authenticated;
revoke all on public.employments from anon, authenticated;
revoke all on public.employment_private_details from anon, authenticated;
revoke all on public.candidate_documents from anon, authenticated;
revoke all on public.recruiter_profiles from anon, authenticated;
revoke all on public.manager_reviews from anon, authenticated;
revoke all on public.contact_requests from anon, authenticated;
revoke all on public.contact_grants from anon, authenticated;
revoke all on public.shortlist_entries from anon, authenticated;
revoke all on public.introduction_requests from anon, authenticated;
revoke all on public.consent_records from anon, authenticated;
revoke all on public.candidate_directory from anon, authenticated;
revoke all on public.candidate_recruiter_detail from anon, authenticated;
revoke all on public.public_manager_reviews from anon, authenticated;
revoke all on public.authenticated_manager_reviews from anon, authenticated;

-- Old browser upload policies are no longer needed because the API uses the
-- service role for private document uploads.
drop policy if exists "candidates upload own resumes" on storage.objects;
drop policy if exists "candidates read own resumes" on storage.objects;
drop policy if exists "candidates delete own resumes" on storage.objects;
drop policy if exists "candidates upload own employment evidence" on storage.objects;
drop policy if exists "candidates read own employment evidence" on storage.objects;
drop policy if exists "candidates delete own employment evidence" on storage.objects;
