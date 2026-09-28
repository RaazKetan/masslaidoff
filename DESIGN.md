# NextSeat — DESIGN.md

## Current direction — September 28, 2026

Use the official Magic UI component source for buttons, cards and motion across the landing page and workspace. Keep effects restrained: brief Blur Fade entrances, Ripple Button interaction feedback, subtle Magic Card highlights and a thin Scroll Progress indicator. Respect reduced-motion preferences. Native form controls cover elements not offered by Magic UI. See COMPONENTS.md for provenance and the component map.

The current user-requested design supersedes the older dark concept below. Use **Google Sans**, a white canvas (`#FFFFFF`), pale gray navigation (`#F8F9FB`), charcoal text (`#25272B`), muted secondary text (`#73777F`), hairline separators (`#E8E9EC`) and one blue interaction accent (`#285DE5`). Use spacious candidate rows, a dedicated filter column, a quiet navigation rail, and flat surfaces. Avoid decorative gradients, large card grids, generic statistics and ornamental imagery. Keep candidate discovery visible in the first viewport. Use the same styling for shortlist, profile forms, manager reviews and native dialogs. See ARCHITECTURE.md for the current product flows and implementation boundaries.

The remaining sections are retained as the earlier design reference, not the active visual specification.

## 1. Visual theme and atmosphere

NextSeat is a private, respectful hiring workspace for people affected by layoffs and the teams hiring them. The experience should feel calm, credible, and efficient—not like a job-board marketplace, a social network, or a public “layoff wall.”

Design it as a focused work surface: dark by default, information-dense without feeling crowded, and intentionally restrained. Let the people and their skills be the visual focus.

**Mood:** composed, precise, human, quietly optimistic.

**Avoid:** celebratory hiring tropes, noisy “talent marketplace” marketing, oversized hero sections, decorative stock photography, or anything that suggests candidate data is public by default.

## 2. Color palette and roles

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#141416` | Primary page background |
| `--surface` | `#1B1B1F` | Navigation, filters, banners |
| `--surface-raised` | `#202024` | Candidate cards and dialogs |
| `--surface-hover` | `#25252B` | Input fields and hover states |
| `--border` | `#303036` | Default separators and card outlines |
| `--border-strong` | `#6851AA` | Selected/focused card outline |
| `--text` | `#F7F7FB` | Primary text |
| `--text-muted` | `#9DA0B2` | Supporting copy and metadata |
| `--accent` | `#A78BFA` | Primary signals, links, focus state |
| `--accent-deep` | `#7657D6` | Input focus border |
| `--success` | `#84DCCB` | Verified or consented status |
| `--warning` | `#FFC16D` | Low-priority attention states |

Use violet only to indicate a primary action, selected state, or meaningful navigation cue. Do not scatter accent color across every element.

## 3. Typography

Use a clean, neutral sans-serif such as **Inter**, **Geist**, or **Manrope**. Use a monospace face such as **DM Mono** only for small labels, status text, and technical metadata.

| Element | Size | Weight | Notes |
| --- | --- | --- | --- |
| Page title | 40–56px | 700–800 | Tight tracking, no more than two lines |
| Section title | 24–32px | 700 | Concise and functional |
| Candidate name | 16–18px | 700 | Primary card anchor |
| Body | 16px | 400–500 | Comfortable, accessible line-height |
| Metadata | 12–14px | 500–600 | Use muted text color |
| Eyebrow/status | 11–12px | 500 | Monospace, uppercase optional |

Use tight headline letter spacing (`-0.03em` to `-0.06em`) and normal body tracking. Never use tiny text for essential information.

## 4. Layout principles

- Start on the talent directory, not a marketing landing page.
- Use a centered content frame of 1200–1460px with 5% horizontal breathing room.
- Keep vertical rhythm compact: 8px, 12px, 16px, 24px, 32px, 48px.
- Make the filters visible before the directory results on desktop.
- Use a three-column card grid on wide screens, two columns on tablet, and one column on mobile.
- Give every control a minimum usable touch target of 40px.
- Use one-pixel borders and flat layers instead of heavy shadows.

## 5. Components

### Navigation

- Dark, 64px-tall navigation with a subtle bottom divider.
- Wordmark on the left; essential routes and one strong action on the right.
- Keep it sticky only if the directory is long enough to make that useful.

### Buttons

- Primary: light near-white fill with dark text; 6px radius.
- Secondary: dark raised fill with a thin border.
- Text action: violet text, no container.
- Use direct labels: “Create profile”, “Request introduction”, “Save filters”.

### Search and filters

- Group inputs in a single raised filter bar.
- Use dark input surfaces, a thin border, and violet focus outline.
- Preserve search text and selected filters while users inspect profiles.

### Candidate cards

- Square-to-soft 8px corners, dark raised surface, one-pixel border.
- Include: initials/avatar, name, role, location, skill tags, short availability note, experience, and profile action.
- On hover, strengthen the border with violet; avoid movement-heavy effects.
- Never show email address, phone number, résumé file, or manager feedback in a directory card.

### Tags and status

- Tags use muted dark fills, thin borders, and compact mono text.
- A verified indicator is a small success-color dot with plain wording.
- Do not use green as generic decoration; reserve it for an actual trust or completion state.

### Dialogs

- Raised dark surface, 8–10px radius, centered, and concise.
- Explain consent before collecting sensitive contact information.
- Prefer private profile setup and recruiter introduction requests over immediate contact disclosure.

## 6. Privacy and trust UX

Privacy is product behavior, not decorative copy.

- Default all contact details to private.
- Show exactly what a recruiter can see before a profile is published.
- Use work-email verification only as an optional proof of employment; do not expose it.
- Do not scrape, mirror, or imply endorsement from LinkedIn or other platforms.
- Manager feedback must be consent-aware, factual, moderated, and separated from a public profile by default.
- Use calm, explicit language: “You decide when to share your contact details.”

## 7. Motion and interaction

- Prefer 150–200ms color, border, and opacity transitions.
- No bouncy, celebratory, or attention-seeking motion.
- Respect `prefers-reduced-motion`.
- Give visible keyboard focus to inputs, controls, and card actions.

## 8. Responsive behavior

- Desktop: three-card grid and inline filters.
- Tablet: two-card grid; filter bar may wrap to two rows.
- Mobile: one-card grid; filters stack cleanly; navigation reduces to the brand and primary action.
- Keep important profile details in natural reading order and avoid horizontal scrolling.

## 9. Design guardrails

**Do:** build an efficient, consent-led hiring workspace; use spacing and typography to create hierarchy; use realistic content and calm trust language.

**Do not:** copy another company’s logo, exact wordmark, product screenshots, or proprietary assets. Do not create a public database of private contact information or unmoderated employer/manager reviews.

## 10. Agent prompt

> Build NextSeat as a dark, precise talent-directory workspace. Use layered charcoal surfaces, fine borders, compact controls, one violet accent, clear information hierarchy, and privacy-first candidate interactions. Keep the searchable directory visible immediately; avoid marketing-heavy layouts and decorative imagery.
