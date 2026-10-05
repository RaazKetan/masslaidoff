-- Require company email verification before reading published manager reviews.
-- This migration is idempotent for environments where earlier migrations have
-- already been applied.

begin;

drop policy if exists "published reviews are readable" on public.manager_reviews;
drop policy if exists "authenticated users read published or own reviews" on public.manager_reviews;

create policy "authenticated users read published or own reviews"
  on public.manager_reviews for select to authenticated
  using (
    auth.uid() = author_id
    or (
      status = 'published'
      and exists (
        select 1
        from public.private_contacts pc
        where pc.user_id = auth.uid()
          and pc.company_email_verified_at is not null
      )
    )
  );

revoke select on public.manager_reviews from anon;

alter view public.public_manager_reviews set (security_invoker = true);
revoke all on public.public_manager_reviews from public, anon;
grant select on public.public_manager_reviews to authenticated;

alter view public.authenticated_manager_reviews set (security_invoker = true);
revoke all on public.authenticated_manager_reviews from public, anon;
grant select on public.authenticated_manager_reviews to authenticated;

commit;
