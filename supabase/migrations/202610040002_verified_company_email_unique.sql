-- A verified company inbox can prove control for only one MassLaidOff account.
create unique index if not exists private_contacts_verified_company_email_unique_idx
  on public.private_contacts(company_email)
  where company_email_verified_at is not null;
