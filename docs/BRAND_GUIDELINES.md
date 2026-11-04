# talent.ai — Brand Guidelines

> **Tagline:** _Intelligent Hiring & Career Acceleration at the Speed of Thought_

## 1. Brand at a glance

| Property | Value |
| :--- | :--- |
| Brand name | `talent.ai` (always lowercase, no space, `.ai` always attached) |
| Wordmark | `talent` in the primary text colour + `.ai` in the gradient accent |
| Icon | Gradient rounded square with a node-linked "T" |
| Primary domain | `https://talent.ai` |
| Candidate portal | `https://app.talent.ai` |
| Recruiter portal | `https://recruiter.talent.ai` |
| Admin portal | `https://admin.talent.ai` |
| API | `https://api.talent.ai` |
| Support | `hello@talent.ai` |

### Pitches

- **Candidate:** _Accelerate your tech career with AI-driven profile insights and smart matching._
- **Recruiter:** _Discover, evaluate, and hire verified high-signal talent in seconds with AI-assisted review._

## 2. Logo & assets

All assets live in [`packages/ui/assets/brand`](../packages/ui/assets/brand).

| Asset | Usage |
| :--- | :--- |
| `talent-ai-logo.svg` | Full wordmark for dark backgrounds (default). |
| `talent-ai-logo-light.svg` | Full wordmark for light backgrounds. |
| `talent-ai-mark.svg` | Icon-only mark, gradients, app icons and favicons. |
| `favicon.svg` | Browser tab icon. |

Both portals mirror these files in their `public/` directory so they can be served at the root.

### Clear space

Keep at least the height of the mark's inner "T" around the logo. Never recolor the mark,
stretch it, add outlines, or place the dark-background wordmark on a light surface.

### Minimum sizes

- Full wordmark: 120px wide
- Icon mark: 24px

## 3. Colour system

Tokens are defined once in [`packages/ui/tailwind-preset.js`](../packages/ui/tailwind-preset.js)
and consumed by both portals through the `@talent-ai/ui/tailwind-preset` export.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `talent-primary` | `#7C3AED` | Primary actions, focus rings, brand gradients |
| `talent-primaryHover` | `#8B5CF6` | Hover states |
| `talent-secondary` | `#06B6D4` | Secondary emphasis, links, AI affordances |
| `talent-accent` | `#A855F7` | Gradient midpoint, highlights |
| `talent-dark` | `#0F0F23` | Application background |
| `talent-darker` | `#080814` | Deep surfaces and overlays |
| `talent-surface` | `#1A1A3E` | Elevated panels |
| `talent-text` | `#E2E8F0` | Primary text on dark |
| `talent-muted` | `#94A3B8` | Secondary text |
| `talent-success` | `#34D399` | Approvals, positive metrics |
| `talent-warning` | `#FBBF24` | Pending states, TalentCredits |
| `talent-danger` | `#FB7185` | Rejections, destructive actions |

Tailwind also exposes the aliases `accent-violet`, `accent-cyan`, `accent-purple`,
`surface-dark`, `surface-card`, and the `bg-talent-gradient` utility.

**Primary gradient:** `linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #06B6D4 100%)`

When using the gradient for text, always pair it with a solid fallback colour for
accessibility and reduced-motion contexts.

## 4. Typography

- **Family:** Inter (Google Fonts), fallback `system-ui, -apple-system, sans-serif`
- **Display / hero:** 700–900 weight, tight tracking (`-0.02em` to `-0.04em`)
- **Body:** 400–500 weight, 1.5–1.7 line height
- **Labels:** 500–600 weight, uppercase only for small eyebrow labels

## 5. Product vocabulary

Use the rebranded names consistently in product copy, analytics and documentation.

| Legacy | talent.ai |
| :--- | :--- |
| Jobify | **TalentSwipe™** |
| Filterify | **TalentLens™** |
| Level 1 | **Junior Fellow** (`LEVEL_1_ENTRY`) |
| Level 2 | **Pro Engineer** (`LEVEL_2_MID`) |
| Level 3 | **Elite Principal** (`LEVEL_3_LEAD`) |
| Smart Match Coins | **TalentCredits (TC)** |
| HR / HR Portal | **Recruiter / Recruiter Portal** |

Descriptions:

- **TalentSwipe™** — swipe-based candidate review with structured feedback.
- **TalentLens™** — natural-language semantic search over the verified talent pool.
- **Verified Talent Tiers** — proficiency bands backed by experience and signals.
- **TalentCredits (TC)** — the participation currency earned through actionable reviews and
  spent on Elite Principal profile unlocks.

## 6. Voice & tone

- Confident, precise, and human — never hype-driven or condescending.
- Prefer concrete outcomes ("review verified talent in seconds") over vague claims.
- Address candidates as "you"; address recruiters by their role, not "HR".
- Keep sentences short. Use sentence case for headings and UI labels.

## 7. UI foundations

- Default surface is the dark gradient background (`#0F0F23 → #1A1A3E → #0F0F23`) with
  glassmorphism panels: `rgba(255,255,255,0.05)` fill, 16–24px blur, 1px white/8–12% border.
- Primary buttons use the brand gradient; hover lifts by 2px with a violet glow.
- Motion is purposeful: 200–500ms, ease-out. Respect `prefers-reduced-motion`.
- Focus states must remain visible and use the primary colour with a 3px translucent ring.
- Maintain WCAG AA contrast for body copy and interactive labels.

## 8. Naming conventions

- Database names: `talent_<domain>` (e.g. `talent_auth`, `talent_profiles`).
- Docker containers / volumes / networks: `talent-ai-*` and `talent_ai_*`.
- RabbitMQ exchange: `talent.events.topic`; DLX: `talent.events.dlx`.
- Packages: `@talent-ai/<name>`.
- Environment variables: `VITE_APP_NAME="talent.ai"`, `VITE_SITE_URL="https://talent.ai"`.

## 9. Do / Don't

| Do | Don't |
| :--- | :--- |
| Write `talent.ai` in lowercase everywhere. | Write `Talent.AI`, `Talent AI`, or `talent ai`. |
| Use the mark with adequate clear space. | Crop, rotate, or add effects to the mark. |
| Use TalentCredits / TC for the currency. | Mix "coins" and "TalentCredits" in the same surface. |
| Use Verified Talent Tier labels. | Expose raw `LEVEL_1` enum values to users. |
| Pair gradient text with readable solid text. | Rely on gradient alone to convey meaning. |
