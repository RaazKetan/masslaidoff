-- Protect manager reviews at the database boundary. Reading published reviews
-- requires an authenticated account with a verified company email. Manager
-- LinkedIn and author identity remain private.

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

drop view if exists public.public_manager_reviews;
create view public.public_manager_reviews
with (security_invoker = true, security_barrier = true) as
select
  mr.id,
  coalesce(c.name, mr.company) as company_name,
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

revoke all on public.public_manager_reviews from public;
revoke all on public.public_manager_reviews from anon;
grant select on public.public_manager_reviews to authenticated;

drop view if exists public.authenticated_manager_reviews;
create view public.authenticated_manager_reviews
with (security_invoker = true, security_barrier = true) as
select
  mr.id,
  mr.manager_name,
  coalesce(c.name, mr.company) as company_name,
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

revoke all on public.authenticated_manager_reviews from public, anon;
grant select on public.authenticated_manager_reviews to authenticated;

commit;
