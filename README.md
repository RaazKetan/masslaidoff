# MassLaidOff

> **A privacy-first talent network connecting laid-off tech professionals with hiring teams.**

A layoff is a change in circumstance, not a measure of talent. MassLaidOff is built to give professionals affected by corporate restructurings full control over their personal narrative, visibility, and sensitive documents, while providing verified hiring teams with authentic talent discovery.

---

## Key Features

### For Candidates
- **Complete Professional Profile**: Showcase your experience, target roles, preferred locations, and skills.
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
- **Differential Privacy Statistics**: Segmented public statistics enforce a minimum threshold of 10 candidates before category breakdowns are revealed, preventing deanonymization of small teams.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vanilla CSS, Vite 7
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) & Storage
- **Typography**: Google Sans
- **Design Aesthetic**: Minimalist white canvas (`#FFFFFF`), pale gray navigation (`#F8F9FB`), charcoal text (`#25272B`), and electric blue accent (`#285DE5`)

---

## Project Structure

```
├── src/
│   ├── lib/
│   │   ├── auth.ts          # Authentication, user accounts, private contacts, consent
│   │   ├── candidates.ts    # Profile CRUD, employments, layoff records, directory
│   │   ├── companies.ts     # Canonical companies search & creation
│   │   ├── contacts.ts      # Contact requests and approval-based grants
│   │   ├── documents.ts     # Supabase Storage document uploads & signed URLs
│   │   ├── recruiters.ts    # Recruiter profiles, shortlist, private notes, view audit
│   │   ├── reviews.ts       # Structured 4-dimension reviews & reporting
│   │   ├── safety.ts        # User reports, blocking, 30-day deletion, JSON export
│   │   ├── stats.ts         # Live aggregate counts with privacy thresholds
│   │   ├── supabase.ts      # Supabase client initialization
│   │   └── types.ts         # TypeScript schema interfaces & safe projection types
│   ├── landing.tsx          # Landing page component
│   ├── workspace.js         # Interactive application logic & routing
│   ├── styles.css           # Workspace styles & design system
│   └── landing.css          # Landing page styles
├── supabase/
│   └── migrations/
│       ├── 202609290001_initial_schema.sql
│       └── 202609290002_complete_schema.sql  # Complete schema, RLS, safe views
├── index.html               # Public landing page
├── workspace.html           # Full workspace application
├── ARCHITECTURE.md          # Architectural decisions & database structure
├── DESIGN.md                # Design guidelines & color palette
└── PRODUCT_SPEC.md          # Complete product specification
```

---

## Getting Started

### 1. Prerequisites
- Node.js 18+
- npm or pnpm
- A Supabase project (optional for preview mode; required for live persistence)

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
```

### 4. Database Setup
Run the migrations in your Supabase SQL editor:
1. `supabase/migrations/202609290001_initial_schema.sql`
2. `supabase/migrations/202609290002_complete_schema.sql`

### 5. Running Locally
```bash
npm run dev
```
Open [http://127.0.0.1:4174/](http://127.0.0.1:4174/) in your browser.

---

## License

MIT License. Built for the community.
