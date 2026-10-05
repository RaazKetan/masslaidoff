-- Hot paths for recruiter discovery, private document reads, and safe aggregates.
create index if not exists employments_latest_candidate_idx
  on public.employments(candidate_id) where is_latest = true;
create index if not exists candidate_documents_current_idx
  on public.candidate_documents(candidate_id, document_type, uploaded_at desc)
  where deleted_at is null;
create index if not exists layoff_records_latest_candidate_idx
  on public.layoff_records(candidate_id, created_at desc);
create index if not exists candidate_profiles_published_recent_idx
  on public.candidate_profiles(published_at desc, id)
  where visibility = 'published';
create index if not exists candidate_profiles_headline_search_idx
  on public.candidate_profiles using gin(headline gin_trgm_ops)
  where visibility = 'published';
create index if not exists user_accounts_name_search_idx
  on public.user_accounts using gin(full_name gin_trgm_ops);
create index if not exists employments_company_search_idx
  on public.employments using gin(company gin_trgm_ops)
  where is_latest = true;
create unique index if not exists contact_requests_one_pending_idx
  on public.contact_requests(recruiter_id, candidate_id) where status = 'pending';
