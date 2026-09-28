# NextSeat — architecture first

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

## Implemented design prototype
The interface now uses React islands built with Vite and official Magic UI components; see COMPONENTS.md. Source HTML lives at the project root, styles and behavior in src/, and dist/ is generated publication output.
Static HTML, CSS and JavaScript. Fictional people and reviews. Search, filters, sorting, shortlist, profile details, introduction preview, candidate form, résumé selection and review preview work in the browser. Shortlists are device-local preferences. Personal information and selected files stay in page memory and reset on reload. No emails, uploads, identity verification, real LinkedIn imports or persistent backend are implemented.

## Visual architecture
Google Sans, white canvas, pale navigation rail, charcoal text and restrained blue interactions. A persistent navigation rail leads into a two-column filter/directory workspace. Spacious rows make experience comparable. Mobile stacks the workspace, native dialogs provide focus containment, and controls have visible keyboard focus. This replaces the earlier dark visual direction in DESIGN.md for the current request.
