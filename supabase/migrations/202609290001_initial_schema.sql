create extension if not exists pgcrypto;
create type public.profile_visibility as enum ('private', 'published', 'paused');
create type public.introduction_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.review_status as enum ('pending', 'published', 'rejected');

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  headline text not null check (char_length(headline) between 2 and 160),
  discipline text not null default 'Other',
  location text not null,
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  summary text check (char_length(summary) <= 1200),
  skills text[] not null default '{}',
  open_to_remote boolean not null default false,
  available_from date,
  personal_email text not null,
  phone text,
  work_email text,
  work_email_verified_at timestamptz,
  visibility public.profile_visibility not null default 'private',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employments (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  company text not null,
  role text not null,
  started_on date,
  ended_on date,
  manager_name text,
  manager_linkedin_url text,
  is_latest boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recruiter_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  company text not null,
  title text,
  work_email text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.shortlist_entries (
  recruiter_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recruiter_id, candidate_id)
);

create table public.introduction_requests (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles(id) on delete cascade,
  role_title text not null,
  message text not null check (char_length(message) between 20 and 2000),
  status public.introduction_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.manager_reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  manager_name text not null,
  manager_linkedin_url text not null,
  company text not null,
  relationship text not null,
  rating smallint not null check (rating between 1 and 5),
  review text not null check (char_length(review) between 30 and 3000),
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index candidate_profiles_discovery_idx on public.candidate_profiles (visibility, published_at desc);
create index candidate_profiles_skills_idx on public.candidate_profiles using gin (skills);
create index employments_candidate_idx on public.employments (candidate_id, is_latest desc);
create index introduction_candidate_idx on public.introduction_requests (candidate_id, status, created_at desc);

create view public.candidate_directory with (security_invoker = true) as
select cp.id, cp.full_name, cp.headline, cp.discipline, cp.location,
  cp.years_experience, cp.summary, cp.skills, cp.open_to_remote,
  cp.available_from, cp.published_at, latest.company as latest_company,
  latest.role as previous_role,
  case when latest.started_on is null then null else concat(extract(year from latest.started_on)::int, ' – ', coalesce(extract(year from latest.ended_on)::int::text, 'Present')) end as latest_period
from public.candidate_profiles cp
left join lateral (
  select company, role, started_on, ended_on from public.employments
  where candidate_id = cp.id order by is_latest desc, ended_on desc nulls first limit 1
) latest on true
where cp.visibility = 'published';

alter table public.candidate_profiles enable row level security;
alter table public.employments enable row level security;
alter table public.recruiter_profiles enable row level security;
alter table public.shortlist_entries enable row level security;
alter table public.introduction_requests enable row level security;
alter table public.manager_reviews enable row level security;

create policy "published candidates are discoverable" on public.candidate_profiles for select using (visibility = 'published' or auth.uid() = user_id);
create policy "candidates manage their profile" on public.candidate_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "published employment is discoverable" on public.employments for select using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and (cp.visibility = 'published' or cp.user_id = auth.uid())));
create policy "candidates manage employment" on public.employments for all using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid())) with check (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "recruiters manage themselves" on public.recruiter_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recruiters manage shortlist" on public.shortlist_entries for all using (auth.uid() = recruiter_id) with check (auth.uid() = recruiter_id);
create policy "parties view introductions" on public.introduction_requests for select using (auth.uid() = recruiter_id or exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "verified recruiters create introductions" on public.introduction_requests for insert with check (auth.uid() = recruiter_id and exists (select 1 from public.recruiter_profiles rp where rp.user_id = auth.uid() and rp.verified_at is not null));
create policy "candidates respond to introductions" on public.introduction_requests for update using (exists (select 1 from public.candidate_profiles cp where cp.id = candidate_id and cp.user_id = auth.uid()));
create policy "authors manage pending reviews" on public.manager_reviews for all using (auth.uid() = author_id and status = 'pending') with check (auth.uid() = author_id and status = 'pending');
create policy "published reviews are readable" on public.manager_reviews for select using (status = 'published' or auth.uid() = author_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf']) on conflict (id) do nothing;
create policy "candidates upload own resumes" on storage.objects for insert to authenticated with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "candidates read own resumes" on storage.objects for select to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "candidates delete own resumes" on storage.objects for delete to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
