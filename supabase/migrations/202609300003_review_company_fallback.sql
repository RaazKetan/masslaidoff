-- Preserve the submitted company name when a review is not linked to a
-- canonical company record yet.

begin;

create or replace view public.public_manager_reviews
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

create or replace view public.authenticated_manager_reviews
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

revoke all on public.public_manager_reviews from public, anon;
grant select on public.public_manager_reviews to authenticated;
revoke all on public.authenticated_manager_reviews from public, anon;
grant select on public.authenticated_manager_reviews to authenticated;

commit;
