-- =============================================================================
-- MassLaidOff — Complete schema migration
-- Builds on 202609290001_initial_schema.sql
-- Aligns the database with PRODUCT_SPEC.md sections 9–12
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Required extensions
-- ---------------------------------------------------------------------------
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. New enum types
-- ---------------------------------------------------------------------------
create type public.account_type         as enum ('candidate', 'recruiter', 'admin');
create type public.contact_mode         as enum ('verified_recruiters', 'request_access', 'hidden');
create type public.layoff_category      as enum ('individual', 'team', 'division', 'company_wide', 'undisclosed');
create type public.verification_status  as enum ('unverified', 'pending', 'verified', 'rejected');
create type public.document_type        as enum ('resume', 'exit_letter', 'salary_slip', 'other_employment_proof');
create type public.doc_verify_status    as enum ('not_required', 'pending', 'verified', 'rejected');
create type public.contact_req_status   as enum ('pending', 'accepted', 'declined', 'expired', 'cancelled');
create type public.preferred_contact    as enum ('email', 'phone', 'either');
create type public.report_status        as enum ('open', 'investigating', 'resolved', 'dismissed');
create type public.deletion_status      as enum ('requested', 'scheduled', 'completed', 'cancelled');

-- ---------------------------------------------------------------------------
-- 2. user_accounts — common identity (spec §10)
-- ---------------------------------------------------------------------------
create table public.user_accounts (
  id                      uuid primary key references auth.users(id) on delete cascade,
  account_type            public.account_type not null,
  full_name               text not null check (char_length(full_name) between 2 and 120),
  avatar_path             text,
  linkedin_url            text,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.user_accounts enable row level security;
create policy "users manage own account"
  on public.user_accounts for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 3. private_contacts — separated from candidate_profiles (spec §10, §11)
-- ---------------------------------------------------------------------------
create table public.private_contacts (
  user_id                   uuid primary key references public.user_accounts(id) on delete cascade,
  personal_email            citext,
  personal_email_verified_at timestamptz,
  company_email             citext,
  company_email_verified_at timestamptz,
  phone_country_code        text,
  phone_number              text,
  phone_verified_at         timestamptz,
  preferred_contact_method  public.preferred_contact not null default 'email'
);

alter table public.private_contacts enable row level security;
create policy "users manage own contacts"
  on public.private_contacts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. companies — canonical company records (spec §10)
-- ---------------------------------------------------------------------------
create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  website      text,
  linkedin_url text,
  logo_url     text,
  industry     text,
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index companies_slug_idx on public.companies (slug);
create index companies_name_idx on public.companies using gin (name gin_trgm_ops);

alter table public.companies enable row level security;
create policy "companies are readable"
  on public.companies for select using (true);

-- ---------------------------------------------------------------------------
-- 5. Alter candidate_profiles — remove private fields, add spec fields
-- ---------------------------------------------------------------------------
-- Migrate existing data to private_contacts first (if any rows exist)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'candidate_profiles'
             and column_name = 'personal_email') then
    -- Migrate existing contact data
    insert into public.user_accounts (id, account_type, full_name)
    select user_id, 'candidate', full_name
    from public.candidate_profiles
    on conflict (id) do nothing;

    insert into public.private_contacts (user_id, personal_email, phone_number)
    select user_id, personal_email, phone
    from public.candidate_profiles
    where personal_email is not null or phone is not null
    on conflict (user_id) do nothing;

    alter table public.candidate_profiles
      drop column if exists personal_email,
      drop column if exists phone,
      drop column if exists work_email,
      drop column if exists work_email_verified_at;
  end if;
end $$;

-- Add new columns per spec
alter table public.candidate_profiles
  add column if not exists primary_role         text,
  add column if not exists contact_visibility   public.contact_mode not null default 'request_access',
  add column if not exists resume_visibility    public.contact_mode not null default 'hidden',
  add column if not exists verification_status  public.verification_status not null default 'unverified',
  add column if not exists profile_completion   smallint not null default 0 check (profile_completion between 0 and 100),
  add column if not exists preferred_locations  text[],
  add column if not exists industry             text;

-- ---------------------------------------------------------------------------
-- 6. skills / candidate_skills — normalized (spec §10)
-- ---------------------------------------------------------------------------
create table public.skills (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  slug     text not null unique,
  category text,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.candidate_skills (
  candidate_id    uuid not null references public.candidate_profiles(id) on delete cascade,
  skill_id        uuid not null references public.skills(id) on delete cascade,
  years_experience numeric,
  display_order   smallint not null default 0,
  primary key (candidate_id, skill_id)
);

alter table public.skills enable row level security;
create policy "skills are readable" on public.skills for select using (true);
create policy "authenticated users can suggest skills"
  on public.skills for insert to authenticated
  with check (approved = false);

alter table public.candidate_skills enable row level security;
create policy "candidates manage own skills"
  on public.candidate_skills for all
  using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()))
  with check (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "published skills are readable"
  on public.candidate_skills for select
  using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.visibility = 'published'));

-- Seed common skills
insert into public.skills (name, slug, category) values
  ('React', 'react', 'Frontend'),
  ('TypeScript', 'typescript', 'Languages'),
  ('JavaScript', 'javascript', 'Languages'),
  ('Python', 'python', 'Languages'),
  ('Go', 'go', 'Languages'),
  ('Java', 'java', 'Languages'),
  ('Node.js', 'nodejs', 'Backend'),
  ('PostgreSQL', 'postgresql', 'Database'),
  ('AWS', 'aws', 'Cloud'),
  ('GCP', 'gcp', 'Cloud'),
  ('Docker', 'docker', 'DevOps'),
  ('Kubernetes', 'kubernetes', 'DevOps'),
  ('System Design', 'system-design', 'Architecture'),
  ('Product Management', 'product-management', 'Product'),
  ('UX Design', 'ux-design', 'Design'),
  ('UI Design', 'ui-design', 'Design'),
  ('Data Analysis', 'data-analysis', 'Data'),
  ('Machine Learning', 'machine-learning', 'Data'),
  ('Team Leadership', 'team-leadership', 'Leadership'),
  ('Agile', 'agile', 'Process'),
  ('Figma', 'figma', 'Design'),
  ('SQL', 'sql', 'Database'),
  ('REST APIs', 'rest-apis', 'Backend'),
  ('GraphQL', 'graphql', 'Backend'),
  ('CI/CD', 'ci-cd', 'DevOps'),
  ('Security', 'security', 'Security'),
  ('Mobile Development', 'mobile-development', 'Mobile'),
  ('Swift', 'swift', 'Languages'),
  ('Kotlin', 'kotlin', 'Languages'),
  ('Rust', 'rust', 'Languages')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Alter employments — add company_id, move private fields
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employments'
             and column_name = 'role') then
    alter table public.employments rename column role to role_title;
  end if;
end $$;

alter table public.employments
  add column if not exists company_id        uuid references public.companies(id),
  add column if not exists role_title        text,
  add column if not exists org_name          text,
  add column if not exists team_name         text,
  add column if not exists location          text,
  add column if not exists short_description text;

-- Move manager data to employment_private_details before dropping
create table public.employment_private_details (
  employment_id      uuid primary key references public.employments(id) on delete cascade,
  manager_name       text,
  manager_linkedin_url text,
  internal_org_details text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Migrate existing manager data
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'employments'
             and column_name = 'manager_name') then
    insert into public.employment_private_details (employment_id, manager_name, manager_linkedin_url)
    select id, manager_name, manager_linkedin_url
    from public.employments
    where manager_name is not null or manager_linkedin_url is not null
    on conflict (employment_id) do nothing;

    alter table public.employments
      drop column if exists manager_name,
      drop column if exists manager_linkedin_url;
  end if;
end $$;

alter table public.employment_private_details enable row level security;
create policy "owners manage private employment details"
  on public.employment_private_details for all
  using (exists (
    select 1 from public.employments e
    join public.candidate_profiles cp on cp.id = e.candidate_id
    where e.id = employment_id and cp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.employments e
    join public.candidate_profiles cp on cp.id = e.candidate_id
    where e.id = employment_id and cp.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 8. layoff_records — defining product feature (spec §10)
-- ---------------------------------------------------------------------------
create table public.layoff_records (
  id                   uuid primary key default gen_random_uuid(),
  candidate_id         uuid not null references public.candidate_profiles(id) on delete cascade,
  employment_id        uuid not null references public.employments(id) on delete cascade,
  layoff_date          date,
  last_working_date    date,
  layoff_category      public.layoff_category not null default 'undisclosed',
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  public_stats_consent boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index layoff_records_candidate_idx on public.layoff_records (candidate_id);

alter table public.layoff_records enable row level security;
create policy "candidates manage own layoff records"
  on public.layoff_records for all
  using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()))
  with check (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "published layoff records are discoverable"
  on public.layoff_records for select
  using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.visibility = 'published'));

-- ---------------------------------------------------------------------------
-- 9. candidate_documents (spec §10)
-- ---------------------------------------------------------------------------
create table public.candidate_documents (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null references public.candidate_profiles(id) on delete cascade,
  document_type       public.document_type not null,
  storage_path        text not null,
  original_filename   text not null,
  mime_type           text not null,
  file_size_bytes     bigint not null check (file_size_bytes > 0),
  verification_status public.doc_verify_status not null default 'not_required',
  uploaded_at         timestamptz not null default now(),
  deleted_at          timestamptz
);

create index candidate_documents_owner_idx on public.candidate_documents (candidate_id, document_type);

alter table public.candidate_documents enable row level security;
create policy "candidates manage own documents"
  on public.candidate_documents for all
  using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()))
  with check (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 10. Alter recruiter_profiles — add company FK, verification
-- ---------------------------------------------------------------------------
alter table public.recruiter_profiles
  add column if not exists company_id           uuid references public.companies(id),
  add column if not exists linkedin_url         text,
  add column if not exists verification_status  public.verification_status not null default 'unverified';

-- Allow verified recruiters to see each other (for discovery)
create policy "verified recruiters are visible"
  on public.recruiter_profiles for select
  using (verified_at is not null or auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 11. Alter shortlist_entries — add private_note
-- ---------------------------------------------------------------------------
alter table public.shortlist_entries
  add column if not exists private_note text;

-- ---------------------------------------------------------------------------
-- 12. candidate_views — recruiter audit trail (spec §10)
-- ---------------------------------------------------------------------------
create table public.candidate_views (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.candidate_profiles(id) on delete cascade,
  recruiter_id    uuid not null references auth.users(id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  access_context  text
);

create index candidate_views_candidate_idx on public.candidate_views (candidate_id, viewed_at desc);
create index candidate_views_recruiter_idx on public.candidate_views (recruiter_id, viewed_at desc);

alter table public.candidate_views enable row level security;
create policy "recruiters create views"
  on public.candidate_views for insert to authenticated
  with check (auth.uid() = recruiter_id);
create policy "recruiters see own views"
  on public.candidate_views for select
  using (auth.uid() = recruiter_id);

-- ---------------------------------------------------------------------------
-- 13. contact_requests / contact_grants (spec §10)
-- ---------------------------------------------------------------------------
create table public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references auth.users(id) on delete cascade,
  candidate_id  uuid not null references public.candidate_profiles(id) on delete cascade,
  message       text not null check (char_length(message) between 20 and 2000),
  status        public.contact_req_status not null default 'pending',
  responded_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index contact_requests_candidate_idx on public.contact_requests (candidate_id, status, created_at desc);
create index contact_requests_recruiter_idx on public.contact_requests (recruiter_id, status);

create table public.contact_grants (
  id                 uuid primary key default gen_random_uuid(),
  contact_request_id uuid not null references public.contact_requests(id) on delete cascade,
  candidate_id       uuid not null references public.candidate_profiles(id) on delete cascade,
  recruiter_id       uuid not null references auth.users(id) on delete cascade,
  granted_fields     text[] not null default '{}',
  expires_at         timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.contact_requests enable row level security;
alter table public.contact_grants enable row level security;

create policy "verified recruiters create contact requests"
  on public.contact_requests for insert to authenticated
  with check (
    auth.uid() = recruiter_id
    and exists (select 1 from public.recruiter_profiles rp
                where rp.user_id = auth.uid() and rp.verified_at is not null)
  );
create policy "parties view contact requests"
  on public.contact_requests for select
  using (
    auth.uid() = recruiter_id
    or exists (select 1 from public.candidate_profiles cp
               where cp.id = candidate_id and cp.user_id = auth.uid())
  );
create policy "candidates respond to contact requests"
  on public.contact_requests for update
  using (exists (select 1 from public.candidate_profiles cp
                 where cp.id = candidate_id and cp.user_id = auth.uid()));

create policy "grant parties view grants"
  on public.contact_grants for select
  using (auth.uid() = recruiter_id
         or exists (select 1 from public.candidate_profiles cp
                    where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "candidates create grants"
  on public.contact_grants for insert to authenticated
  with check (exists (select 1 from public.candidate_profiles cp
                      where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "candidates revoke grants"
  on public.contact_grants for update
  using (exists (select 1 from public.candidate_profiles cp
                 where cp.id = candidate_id and cp.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 14. Alter manager_reviews — add structured ratings (spec §10)
-- ---------------------------------------------------------------------------
alter table public.manager_reviews
  add column if not exists employment_id        uuid references public.employments(id) on delete set null,
  add column if not exists leadership_rating    smallint check (leadership_rating between 1 and 5),
  add column if not exists communication_rating smallint check (communication_rating between 1 and 5),
  add column if not exists fairness_rating      smallint check (fairness_rating between 1 and 5),
  add column if not exists career_growth_rating smallint check (career_growth_rating between 1 and 5),
  add column if not exists review_title         text,
  add column if not exists moderation_notes     text,
  add column if not exists published_at         timestamptz;

-- Rename 'review' to 'review_body' for clarity (keep original for compatibility)
-- We'll use review_body in new code, existing 'review' column stays

-- ---------------------------------------------------------------------------
-- 15. verification_requests / verification_evidence (spec §10)
-- ---------------------------------------------------------------------------
create table public.verification_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  verification_type  text not null check (verification_type in ('employment', 'layoff', 'recruiter_company')),
  status             public.verification_status not null default 'pending',
  submitted_at       timestamptz not null default now(),
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  rejection_reason   text
);

create table public.verification_evidence (
  id                      uuid primary key default gen_random_uuid(),
  verification_request_id uuid not null references public.verification_requests(id) on delete cascade,
  document_id             uuid references public.candidate_documents(id),
  evidence_type           text not null,
  created_at              timestamptz not null default now()
);

alter table public.verification_requests enable row level security;
alter table public.verification_evidence enable row level security;

create policy "users manage own verification requests"
  on public.verification_requests for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users view own verification evidence"
  on public.verification_evidence for select
  using (exists (select 1 from public.verification_requests vr
                 where vr.id = verification_request_id and vr.user_id = auth.uid()));
create policy "users submit verification evidence"
  on public.verification_evidence for insert to authenticated
  with check (exists (select 1 from public.verification_requests vr
                      where vr.id = verification_request_id and vr.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 16. public_metrics_daily — precomputed stats (spec §10, §13)
-- ---------------------------------------------------------------------------
create table public.public_metrics_daily (
  id                     uuid primary key default gen_random_uuid(),
  metric_date            date not null,
  company_id             uuid references public.companies(id),
  published_candidates   integer not null default 0,
  verified_candidates    integer not null default 0,
  new_profiles           integer not null default 0,
  companies_represented  integer not null default 0,
  profiles_by_role       jsonb,
  profiles_by_location   jsonb,
  unique (metric_date, company_id)
);

alter table public.public_metrics_daily enable row level security;
create policy "metrics are public" on public.public_metrics_daily for select using (true);

-- ---------------------------------------------------------------------------
-- 17. Safety tables (spec §10)
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

create table public.user_reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  report_type     text not null,
  details         text,
  status          public.report_status not null default 'open',
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  consent_type    text not null,
  policy_version  text not null,
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz
);

create table public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  resource    text,
  resource_id uuid,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create table public.account_deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  reason         text,
  status         public.deletion_status not null default 'requested',
  scheduled_for  timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table public.review_reports (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null references public.manager_reviews(id) on delete cascade,
  reported_by_user_id uuid not null references auth.users(id) on delete cascade,
  reason            text not null,
  details           text,
  status            public.report_status not null default 'open',
  resolved_by       uuid references auth.users(id),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

-- RLS for safety tables
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_events enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.review_reports enable row level security;

create policy "users manage own blocks"
  on public.user_blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "users create reports"
  on public.user_reports for insert to authenticated with check (auth.uid() = reporter_id);
create policy "users view own reports"
  on public.user_reports for select using (auth.uid() = reporter_id);
create policy "users view own consent"
  on public.consent_records for select using (auth.uid() = user_id);
create policy "users create consent"
  on public.consent_records for insert to authenticated with check (auth.uid() = user_id);
create policy "users request own deletion"
  on public.account_deletion_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users report reviews"
  on public.review_reports for insert to authenticated with check (auth.uid() = reported_by_user_id);
create policy "users view own review reports"
  on public.review_reports for select using (auth.uid() = reported_by_user_id);

-- Audit events: insert-only for authenticated, read restricted to admin via Go service
create policy "system inserts audit events"
  on public.audit_events for insert to authenticated with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 18. Updated views (spec §11)
-- ---------------------------------------------------------------------------

-- Drop the old view
drop view if exists public.candidate_directory;

-- candidate_directory: safe searchable fields only — NO private data
create view public.candidate_directory with (security_invoker = true) as
select
  cp.id,
  cp.user_id,
  cp.headline,
  cp.discipline,
  cp.primary_role,
  cp.location,
  cp.years_experience,
  cp.summary as short_intro,
  cp.open_to_remote,
  cp.available_from,
  cp.preferred_locations,
  cp.industry,
  cp.verification_status,
  cp.profile_completion,
  cp.contact_visibility,
  cp.resume_visibility,
  cp.published_at,
  ua.full_name,
  ua.avatar_path,
  latest.company_name   as latest_company,
  latest.role_title     as previous_role,
  latest.period         as latest_period,
  lr.layoff_date,
  lr.last_working_date,
  lr.layoff_category
from public.candidate_profiles cp
join public.user_accounts ua on ua.id = cp.user_id
left join lateral (
  select
    coalesce(c.name, e.company) as company_name,
    e.role_title as role_title,
    case when e.started_on is null then null
         else concat(extract(year from e.started_on)::int, ' – ',
                     coalesce(extract(year from e.ended_on)::int::text, 'Present'))
    end as period
  from public.employments e
  left join public.companies c on c.id = e.company_id
  where e.candidate_id = cp.id
  order by e.is_latest desc, e.ended_on desc nulls first
  limit 1
) latest on true
left join lateral (
  select layoff_date, last_working_date, layoff_category
  from public.layoff_records
  where candidate_id = cp.id
  order by created_at desc
  limit 1
) lr on true
where cp.visibility = 'published';

-- candidate_recruiter_detail: extended view for verified recruiters
create view public.candidate_recruiter_detail with (security_invoker = true) as
select
  cd.*,
  array(
    select s.name from public.candidate_skills cs
    join public.skills s on s.id = cs.skill_id
    where cs.candidate_id = cd.id
    order by cs.display_order
  ) as skill_names,
  array(
    select jsonb_build_object(
      'id', e.id,
      'company', coalesce(c.name, e.company),
      'role', e.role_title,
      'org_name', e.org_name,
      'team_name', e.team_name,
      'location', e.location,
      'started_on', e.started_on,
      'ended_on', e.ended_on,
      'description', e.short_description,
      'is_latest', e.is_latest
    )
    from public.employments e
    left join public.companies c on c.id = e.company_id
    where e.candidate_id = cd.id
    order by e.is_latest desc, e.ended_on desc nulls first
  ) as employment_history,
  (select exists(
    select 1 from public.candidate_documents doc
    where doc.candidate_id = cd.id and doc.document_type = 'resume' and doc.deleted_at is null
  )) as has_resume
from public.candidate_directory cd;

-- public_manager_reviews: published reviews without author or manager LinkedIn
create view public.public_manager_reviews with (security_invoker = true) as
select
  mr.id,
  mr.manager_name,
  c.name as company_name,
  mr.relationship,
  mr.rating,
  mr.leadership_rating,
  mr.communication_rating,
  mr.fairness_rating,
  mr.career_growth_rating,
  mr.review_title,
  mr.review as review_body,
  mr.published_at,
  mr.created_at
from public.manager_reviews mr
left join public.employments e on e.id = mr.employment_id
left join public.companies c on c.id = e.company_id
where mr.status = 'published';

-- public_platform_metrics: thresholded aggregate data
create view public.public_platform_metrics with (security_invoker = true) as
select
  metric_date,
  published_candidates,
  verified_candidates,
  new_profiles,
  companies_represented,
  profiles_by_role,
  profiles_by_location
from public.public_metrics_daily
where company_id is null
  and published_candidates >= 10
order by metric_date desc;

-- ---------------------------------------------------------------------------
-- 19. Additional indexes
-- ---------------------------------------------------------------------------
create index if not exists candidate_profiles_visibility_idx
  on public.candidate_profiles (visibility, published_at desc);
create index if not exists candidate_profiles_location_idx
  on public.candidate_profiles (location) where visibility = 'published';
create index if not exists candidate_profiles_role_idx
  on public.candidate_profiles (primary_role) where visibility = 'published';
create index if not exists user_accounts_type_idx
  on public.user_accounts (account_type);

-- ---------------------------------------------------------------------------
-- 20. Additional storage buckets (spec §12)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('employment-evidence', 'employment-evidence', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png']),
  ('profile-avatars', 'profile-avatars', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Storage policies for employment-evidence
create policy "candidates upload own evidence"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'employment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "candidates read own evidence"
  on storage.objects for select to authenticated
  using (bucket_id = 'employment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "candidates delete own evidence"
  on storage.objects for delete to authenticated
  using (bucket_id = 'employment-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for profile-avatars
create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-avatars');
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 21. Helper function: compute profile completion percentage
-- ---------------------------------------------------------------------------
create or replace function public.compute_profile_completion(p_candidate_id uuid)
returns smallint language sql stable as $$
  select (
    (case when ua.full_name is not null then 10 else 0 end) +
    (case when cp.headline is not null then 10 else 0 end) +
    (case when cp.location is not null then 10 else 0 end) +
    (case when cp.years_experience > 0 then 5 else 0 end) +
    (case when cp.summary is not null and char_length(cp.summary) > 10 then 10 else 0 end) +
    (case when exists(select 1 from public.candidate_skills cs where cs.candidate_id = cp.id) then 10 else 0 end) +
    (case when exists(select 1 from public.employments e where e.candidate_id = cp.id) then 15 else 0 end) +
    (case when exists(select 1 from public.layoff_records lr where lr.candidate_id = cp.id) then 10 else 0 end) +
    (case when exists(select 1 from public.candidate_documents d where d.candidate_id = cp.id and d.document_type = 'resume' and d.deleted_at is null) then 10 else 0 end) +
    (case when cp.contact_visibility != 'hidden' then 5 else 0 end) +
    (case when exists(select 1 from public.consent_records cr where cr.user_id = cp.user_id and cr.consent_type = 'privacy_policy' and cr.revoked_at is null) then 5 else 0 end)
  )::smallint
  from public.candidate_profiles cp
  join public.user_accounts ua on ua.id = cp.user_id
  where cp.id = p_candidate_id;
$$;
