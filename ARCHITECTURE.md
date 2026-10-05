# MassLaidOff architecture

The production backend design, API surface, security model, deployment topology, and implementation phases are defined in `BACKEND_DESIGN.md`.

## Product architecture

Candidate: create profile → add work experience and résumé → link former manager → choose visibility → approve recruiter introductions.
Recruiter: browse directory → filter role, location, skills and experience → inspect profile → shortlist → request introduction.
Manager reviews: link manager's LinkedIn URL → confirm employment relationship → submit first-person review → moderation → publication.

## Screen architecture

The product is a single React application with clean browser routes. The landing page sends job seekers to `/login/job-seeker` and hiring teams to `/login/hiring`. After authentication, candidates enter `/app/profile` and recruiters enter `/app/discover`. Manager reviews use `/app/reviews`.

## Production data model

User → CandidateProfile → Employment → ManagerProfile.
CandidateProfile → ResumeAsset + ContactDetails.
Recruiter → OrganizationMembership → HiringOrganization.
Recruiter → ShortlistEntry → CandidateProfile.
Recruiter → IntroductionRequest → CandidateApproval → ContactGrant.
Employment → ManagerReview → ModerationDecision.

## Service architecture

Browser → authenticated Go API → relational database and private document storage.

- Identity: personal email sign-in. Work email is optional employment evidence; alternative verification for inaccessible former mailboxes.
- Profiles: authenticated CRUD, visibility controls, owner-only editing and deletion.
- Discovery: indexed skills, experience, roles, locations and availability.
- Résumés: private object storage, PDF validation, malware scanning, expiring authorized downloads.
- Introductions: verified hiring organizations, candidate approval, revocable contact grants, notifications.
- Managers: user-supplied LinkedIn profile URL, authorized provider import where available, manual confirmation otherwise. Never assume a supplied URL proves identity.
- Reviews: relationship verification, first-person reviews, moderation, reports, correction workflow. No automatic publishing.
  Private contact fields never appear in directory API responses. Enforce record authorization on the server, keep provider credentials server-side, and audit sensitive reads and grants.

## Application stack

React 19 and Vite power the client. Supabase provides authentication, Postgres, row-level security, and private résumé storage. A stateless Go service is the only application-data boundary. The browser uses Supabase directly only for authentication and sends the access token to the Go API. The schema lives in `supabase/migrations`; browser configuration is read from `.env.local` and server secrets are read from `backend/.env` or the production secret manager.

The public candidate directory intentionally excludes personal email, work email, phone and résumé paths. Those fields remain owner-only. Introduction requests require an authenticated, verified recruiter and candidate approval before any future contact grant is created.

## Local setup

1. Copy `.env.example` to `.env.local` and add the public Supabase Auth values and API URL.
2. Apply every SQL file in `supabase/migrations` in filename order.
3. Copy `backend/.env.example` to `backend/.env` and add database, Supabase, Storage, and Resend secrets.
4. Run the Go API with `cd backend && go run ./cmd/api`.
5. Run the React app with `npm install && npm run dev`.
