# MassLaidOff

> **A privacy-first talent network connecting laid-off tech professionals with hiring teams.**

A layoff is a change in circumstance, not a measure of talent. MassLaidOff is built to give professionals affected by corporate restructurings full control over their personal narrative, visibility, and sensitive documents, while providing verified hiring teams with authentic talent discovery.

---

## Key Features

### For Candidates

- **Complete Professional Profile**: Showcase your experience, location, availability, and professional context.
- **3-Tier Visibility Controls**:
  - `request_access`: Recruiters introduce themselves before contact details are revealed.
  - `verified_recruiters`: Directly visible to verified hiring teams.
  - `hidden`: Searchable in directory without contact capabilities.
- **Privacy Separation**: Personal emails, phone numbers, and manager LinkedIn URLs are separated into restricted tables with Row-Level Security (RLS).
- **Document Protection**: Resumes, exit letters, and salary slips are stored in private Supabase Storage buckets. Relieving letters and salary slips are used strictly for internal verification and are **never** displayed to recruiters.
- **Recruiter View Preview**: Preview exactly what verified recruiters see before publishing your profile.
- **Data Portability & 30-Day Deletion**: Export your complete profile as a JSON archive anytime. Account deletion is scheduled with a 30-day grace period.

### For Hiring Teams & Recruiters

- **Search & Discovery**: Filter by discipline (Engineering, Design, Product, Data), location, remote preference, experience level, verified employment status, and resume availability.
- **Interactive Shortlist**: Save top talent and write confidential recruiter notes (`shortlist_entries.private_note`) directly on candidate cards.
- **Approval-Based Introductions**: Send contact requests with 14-day expiry and 90-day grant terms.

### Trust, Safety & Community Insights

- **Structured Manager Reviews**: 4 rating dimensions (Leadership, Communication, Fairness, Career Growth Support) with identity verification to prevent fabricated reviews.
- **Safety & Moderation**: Integrated user reporting (`user_reports`), review reporting (`review_reports`), and blocking (`user_blocks`).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vanilla CSS, Vite 7
- **Backend**: Go 1.24 modular monolith with Chi and pgx
- **Database, Auth & Storage**: Supabase PostgreSQL, Auth, and private Storage
- **Transactional Email**: Resend for company email verification
- **Deployment**: Vercel frontend and a container-ready API for Google Cloud Run
- **Typography**: Google Sans
- **Design Aesthetic**: Minimalist white canvas (`#FFFFFF`), pale gray navigation (`#F8F9FB`), charcoal text (`#25272B`), and electric blue accent (`#285DE5`)

---

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── api.ts           # Authenticated calls to the Go API
│   │   ├── auth.ts          # Supabase Auth session operations only
│   │   ├── supabase.ts      # Auth client initialization
│   │   └── types.ts         # UI and API response types
│   ├── components/magicui/  # Restrained motion and surface primitives
│   ├── main.tsx             # React application, routes, and screens
│   └── app.css              # Responsive product design system
├── backend/
│   ├── cmd/api/              # API process entry point
│   ├── internal/auth/        # Supabase access token verification
│   ├── internal/httpapi/     # Routes, validation, CORS, and responses
│   ├── internal/store/       # PostgreSQL transactions and authorization
│   └── Dockerfile            # Production container
├── supabase/
│   └── migrations/
│       ├── 202609290001_initial_schema.sql
│       └── 202609290002_complete_schema.sql  # Complete schema, RLS, safe views
├── index.html               # Single React application shell
├── BACKEND_DESIGN.md        # Production Go and Supabase backend design
├── ARCHITECTURE.md          # Architectural decisions & database structure
├── DESIGN.md                # Design guidelines & color palette
└── PRODUCT_SPEC.md          # Complete product specification
```

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- npm or pnpm
- Go 1.24+
- A Supabase project
- A Resend account for production verification email

### 2. Installation

```bash
git clone https://github.com/RaazKetan/masslaidoff.git
cd masslaidoff
npm install
```

### 3. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Add your Supabase project credentials in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://127.0.0.1:8080
```

### 4. Database Setup

Run the migrations in your Supabase SQL editor:

1. `supabase/migrations/202609290001_initial_schema.sql`
2. `supabase/migrations/202609290002_complete_schema.sql`
3. `supabase/migrations/202609300001_protect_manager_names.sql`
4. `supabase/migrations/202609300002_require_company_email_for_reviews.sql`
5. `supabase/migrations/202609300003_review_company_fallback.sql`
6. `supabase/migrations/202609300004_backend_boundary.sql`

The final migration removes direct browser access to application tables. The browser continues to use Supabase Auth, while profiles, reviews, search, verification, and document operations go through the Go API.

### 5. Authentication Setup

In Supabase Authentication:

1. Keep email and password authentication enabled.
2. Enable the Google provider and add your Google OAuth client ID and secret.
3. Add the local and production application URLs to the allowed redirect URLs.
4. Set the Email OTP expiry to 600 seconds so signup and password-recovery links expire after 10 minutes. This is a Supabase project setting, not a frontend timer.

Google and email authentication return job seekers to `/app/profile` and hiring teams to `/app/discover`.

When Supabase is not configured, localhost offers a development-only demo login:

- Job seeker: `aarav.mehta@example.com` / `TestFlow!2026`
- Hiring team: `priya@acmehire.example` / `HiringTest!2026`

The demo fallback only runs on `localhost` or `127.0.0.1`. Deployed environments always require Supabase.

The Go API also issues separate company-email challenges with a 10-minute lifetime. It applies per-peer request limits of 120 reads and 30 writes per minute. These in-process limits are only a safety layer: a multi-instance production deployment still needs an edge or shared-store rate limiter, plus Supabase Auth rate limits and CAPTCHA for signup and recovery.

Recruiters must verify a company email before searching or opening profiles. Candidates can make contact and résumé access visible, hidden, or available by approval. Approval lasts 30 days, and changing visibility or a recruiter's company email revokes existing grants. The public `/data` page counts only published candidates who explicitly opt in; company counts below three are suppressed.

### 6. Backend Setup

```bash
cd backend
cp .env.example .env
```

Set `DATABASE_URL`, `SUPABASE_SECRET_KEY`, the other Supabase values, and `RESEND_API_KEY`. In development, leaving `RESEND_API_KEY` empty returns a local verification link in the API response. Production never returns raw verification tokens.

Start the API:

```bash
go run ./cmd/api
```

### 7. Running the Frontend Locally

```bash
npm run dev
```

Open [http://127.0.0.1:4174/](http://127.0.0.1:4174/) in your browser.

### 8. Verification

```bash
cd backend && go test ./... && go vet ./...
cd .. && npm run typecheck && npm test && npm run build
```

---

## License

MIT License. Built for the community.
