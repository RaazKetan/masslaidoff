-- The browser only uses Supabase Auth; all data and files go through the Go API
-- (service role). Close every remaining direct path from anon/authenticated.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- 202609300004 dropped policy names that never existed; drop the real ones.
drop policy if exists "candidates upload own evidence" on storage.objects;
drop policy if exists "candidates read own evidence" on storage.objects;
drop policy if exists "candidates delete own evidence" on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "avatars are publicly readable" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;

