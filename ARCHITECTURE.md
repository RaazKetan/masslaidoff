# MassLaidOff architecture

## Product architecture
Candidate: create profile → add work experience and résumé → link former manager → choose visibility → approve recruiter introductions.
Recruiter: browse directory → filter role, location, skills and experience → inspect profile → shortlist → request introduction.
Manager reviews: link manager's LinkedIn URL → confirm employment relationship → submit first-person review → moderation → publication.

## Screen architecture
The root now opens a dedicated landing page with candidate and hiring-team paths. The existing application lives at workspace.html with its existing hash routes. Old root hash links redirect to the matching workspace screen.
Discover talent is the starting screen. Shortlist reuses the directory. My profile holds work history, private contact information, résumé and manager reference. Manager reviews are separate from candidate hiring profiles.

## Production data model
User → CandidateProfile → Employment → ManagerProfile.
CandidateProfile → ResumeAsset + ContactDetails.
Recruiter → OrganizationMembership → HiringOrganization.
Recruiter → ShortlistEntry → CandidateProfile.
Recruiter → IntroductionRequest → CandidateApproval → ContactGrant.
Employment → ManagerReview → ModerationDecision.

## Service architecture
Browser → authenticated application API → relational database and private document storage.
- Identity: personal email sign-in. Work email is optional employment evidence; alternative verification for inaccessible former mailboxes.
- Profiles: authenticated CRUD, visibility controls, owner-only editing and deletion.
- Discovery: indexed skills, experience, roles, locations and availability.
- Résumés: private object storage, PDF validation, malware scanning, expiring authorized downloads.
- Introductions: verified hiring organizations, candidate approval, revocable contact grants, notifications.
- Managers: user-supplied LinkedIn profile URL, authorized provider import where available, manual confirmation otherwise. Never assume a supplied URL proves identity.
- Reviews: relationship verification, first-person reviews, moderation, reports, correction workflow. No automatic publishing.
Private contact fields never appear in directory API responses. Enforce record authorization on the server, keep provider credentials server-side, and audit sensitive reads and grants.

## Application stack
React 19 and Vite power the client. Supabase provides passwordless authentication, Postgres, row-level security and private résumé storage. The initial schema lives in `supabase/migrations`; browser configuration is read from `.env.local`.

The public candidate directory intentionally excludes personal email, work email, phone and résumé paths. Those fields remain owner-only. Introduction requests require an authenticated, verified recruiter and candidate approval before any future contact grant is created.

## Local setup
1. Copy `.env.example` to `.env.local` and add the Supabase project URL and anon key.
2. Apply `supabase/migrations/202609290001_initial_schema.sql` to the Supabase project.
3. Apply `supabase/migrations/202609290002_complete_schema.sql` to complete the schema (user_accounts, private_contacts, companies, skills, layoff_records, documents, contact flow, verification, metrics, and safety tables).
4. Run `npm install`, then `npm run dev`.

