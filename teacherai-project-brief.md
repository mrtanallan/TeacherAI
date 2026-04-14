# TeacherAI — Developer Handover

**Last updated:** April 14, 2026
**Current production build:** `2026-04-14-AJ+`
**Status:** Beta-ready. 1 active tester. Imminent Facebook post to 5,300 YRDSB teachers.

---

## Product Context

**TeacherAI** (teacherai.ca) is an AI-assisted lesson planning and assessment tool built specifically for Ontario K-8 teachers. Target user: classroom teachers, including split-grade and special-ed teachers.

**What it does:**
- Generates Ontario-curriculum-aligned lesson plans, student worksheets, reading resources, rubrics, and answer keys
- Teaching slide decks with subject-specific visual renderers (math, science, literacy, K)
- Student worksheet delivery via shareable links (no student accounts)
- Assessment tracking + descriptive feedback
- Report card comment generation (PowerSchool-compatible format)
- Unit planning
- K-specific Play Invitation format with observational assessment

**Primary differentiators vs MagicSchool / Chalkie / Kuraplan:**
- Genuinely Ontario-specific (curriculum expectations, MFIPPA compliance, Ontario Achievement Chart)
- Canadian data residency (Supabase ca-central-1 in Montreal)
- Student names never sent to Anthropic (anonymized as "Student A/B/C")
- K hardcoded SVG renderers (triangles actually render as triangles, not chicks)
- Split-grade support (ABAB + parallel lessons)
- Free during beta

**Stack:**
- Frontend: single-file HTML + vanilla JS (`index-14.html`, ~10,979 lines, ~700KB)
- Hosting: Vercel (Hobby plan)
- Database: Supabase (free tier, ca-central-1)
- AI: Anthropic API (Claude Sonnet 4.6 primary, with fallback chain)
- Image gen: Fal.ai Flux Schnell (plus K hardcoded SVGs)
- DNS: Cloudflare (active, DNS-only mode)
- Email: Cloudflare Email Routing → `teacheraicanada@gmail.com`
- Domain registrar: GoDaddy (teacherai.ca + teacher.ca owned)

---

## User Preferences (Carries Across Sessions)

From active userPreferences:

> Act as a product strategist + senior engineer helping me build TeacherAI (an AI tool for Ontario teachers).
>
> **Prioritize:** Practical buildable solutions over theory. Simplicity and speed (low token cost, low UI complexity). Teacher usability and low mental load. Strong differentiation vs existing tools (MagicSchool, Chalkie, etc.). Clear product decisions, not just options.
>
> **When responding:** Default to strong recommendation, not multiple equal options. Think in terms of real classroom use (K-8, split grades, SSC). Optimize for workflows that save teachers time immediately. Consider cost of generation (tokens, API calls) in design decisions. Flag anything that could become a competitive moat.
>
> **Avoid:** Overly academic explanations. Feature bloat. Vague answers without concrete implementation direction.
>
> Challenge my assumptions when needed and point out weak ideas directly.

Dev works solo. Testing pattern: user generates lessons → screenshots bugs → Claude patches → user deploys → re-tests. Multi-day sprints. User prefers direct honest pushback over sycophantic agreement.

---

## Current File State (`/mnt/user-data/outputs/`)

| File | Build | Deployed? | What it does |
|------|-------|-----------|--------------|
| `index-14.html` | AJ+ | ✅ Yes | Main app — all UI, prompts, renderers |
| `worksheet-6.html` | AC | ✅ Yes | Student-facing worksheet page |
| `generate-4.js` | AB | ✅ Yes | Backend lesson API (streaming + fallback chain) |
| `generate-image-3.js` | unstamped | ✅ Yes | Backend Flux image gen + CORS tightening |
| `worksheet-3.js` | AC | ✅ Yes | Backend worksheet submit/fetch + CORS |
| `privacy.html` | Apr 14 2026 | ✅ Yes | Privacy policy with clean contact@teacherai.ca |
| `terms.html` | Apr 14 2026 | ✅ Yes | Terms of service with clean contact@teacherai.ca |

All deployed to production as of end of April 14, 2026 session.

---

## Key File Locations in index-14.html

| Feature | Line (approx) | Notes |
|---------|---------------|-------|
| `callGenerateStreaming` | 1385 | Client-side streaming helper w/ 529 retry |
| `authFetch` / `retryAuthFetch` | 1348 / 1365 | Auth-wrapped fetch |
| K worksheet prompt (`kWorksheetFormat`) | 2959 | K-specific prompt format |
| `addMoreQuestions` | 4071 | Add-questions flow |
| Lesson prompt grade branch | 3062 | Grades 1-8 vs K branching |
| `renderKWS` K worksheet renderer | 3918 | K worksheet HTML output |
| `renderRubric` | 3695 | Rubric renderer (AH fixed lazy grid) |
| `renderAnswerKey` | 3767 | Answer key renderer (AG+ regex expanded) |
| `downloadKPDF` K worksheet PDF | 4596 | K PDF export (AJ+ activity wrapper) |
| `_kHardcodedSVG` | ~3905 | AJ hardcoded K shapes/objects |
| `loadKWorksheetImages` | ~4092 | Intercepts Flux with hardcoded first |
| `generateSlideData` | 4740 | Slide structure generation |
| `generateAndPushVisuals` | 7004 | Slide visual generation |
| `grouped_objects` renderer | 6184 | Math grouping visual |
| `sort_diagram` renderer | 5907 | Sorting diagram (AJ+ 2-col) |
| `money_display` renderer | 6367 | Canadian coins (AG .toFixed + toonie ring) |
| Slide JSON spec | 4665 | Slide structure prompt |
| `displayStudentName` | 3570 | Roster name resolution |
| `TA_BUILD` constant | ~5208 | Build banner (bumps each session) |
| Model refs | 10 sites | All `claude-sonnet-4-6` as of AB |

---

## Build Ledger (V → AJ+, Last Two Days)

Each build has a banner in console on page load. Recent builds:

- **V**: Client-side 529 retry in callGenerateStreaming
- **W**: Removed build-S residue. `buildDeckStyleSeed()` for image consistency. K PDF pagination CSS. worksheet-6.html crypto fallback.
- **X**: CRITICAL — retry entire request+stream phase, detects SSE `overloaded_error` inside HTTP 200
- **Y**: Fixed `1. ### Title` leak, K prompt contradiction, slides prompt mode-chart rules
- **Z/AA**: Server-side model fallback chain (Sonnet → Opus → Sonnet 4.5 → Haiku)
- **AB**: Upgraded default to Sonnet 4.6
- **AC**: CRITICAL — worksheet submit was silently broken since T. Fixed student_name empty bypass. Coin SVG renderers.
- **AD**: Division equation flip, roster filter by grade, Flux count stripping, diagnostic logging
- **AE**: CRITICAL — lesson_plan empty bug solved (quote-nesting in JSON strings)
- **AF**: Grade-fit (any grade) bypass, rubric renderer handles #, science inquiry no longer routes to reading_strategy, answer_key quote fix
- **AG**: Rubric prompt tightened, defensive asterisk stripping, token budget 3200→4800, money display .toFixed(2), Mindson image uses topic-only
- **AG+**: Answer key regex expanded for parenthetical qualifiers
- **AH**: RUBRIC LAYOUT — lazy grid opening so all 4 levels sit on one row
- **AJ**: K HARDCODED SVG RENDERERS — 12 shapes, 14 objects, 12 colours × shapes = 144 combos. Skipped letter AI to avoid confusion with term "AI"
- **AJ+**: Activity-wrapper state machine for K PDF, K assessment toast, sort_diagram 2-col

---

## Infrastructure Details

### Security
- **Supabase RLS**: Audited April 14. 15 tables, all RLS enabled. 19 policies. All policies correctly scoped to `teacher_id = auth.uid()` or equivalent joined check. `access_codes` and `image_cache` are RLS-locked with zero policies (service-role-only, correct pattern).
- **AUTH_ENFORCE=true** confirmed in Vercel env vars
- **Rate limiting**: Two-layer implemented in generate-4.js:
  - Layer 1: Monthly lesson cap per plan (free=5, beta=∞, pro=∞)
  - Layer 2: Daily abuse ceiling (free=50/24h, beta=500/24h, pro=2000/24h)
  - Fail-open on Supabase outage (correct pattern)
  - Uses `generations` table for persistent counting
- **Spending caps**:
  - Anthropic: $100/month (returns 429 when exceeded)
  - Fal.ai: $30/month
  - Supabase: free tier, usage alerts configured
- **CORS**: All three backend endpoints whitelist teacherai.ca origins only
- **Model fallback chain** (generate-4.js): `sonnet-4-6 → opus-4-6 → sonnet-4-5 → sonnet-4-20250514 → haiku-4-5-20251001`

### DNS / Email
- **Nameservers**: `jason.ns.cloudflare.com` + `kara.ns.cloudflare.com` (Cloudflare)
- **All DNS records in "DNS only" mode** (gray cloud) — required for Vercel compatibility. Do NOT enable proxy.
- **Email Routing active**: `contact@teacherai.ca` → `teacheraicanada@gmail.com`
- **Catch-all enabled**: any `@teacherai.ca` → `teacheraicanada@gmail.com`
- **Email Address Obfuscation OFF** (emails display as plain text in HTML)
- Gmail tip: incoming forwarded mail may land in Spam; filter rule created to auto-allow

### Domains owned
- `teacherai.ca` — primary, active
- `teacher.ca` — owned but not configured. Deferred decision (park / redirect / future enterprise brand)

### MFIPPA Compliance
- Canadian data residency (Supabase ca-central-1, Montreal AWS)
- Student names never sent to Anthropic
- Assessment data never sent to Anthropic
- Worksheet submissions never sent to Anthropic
- Student name hashing since build T
- Privacy policy + Terms of Service published at `/privacy.html` and `/terms.html`
- Real contact@teacherai.ca email visible on both

---

## K Hardcoded SVG Library (Build AJ Moat Play)

**Problem solved:** Flux Schnell drew chicks instead of triangles, donut-ring-donut for patterns, "square with Y" for rectangles.

**Coverage:**
- 12 shapes: circle, square, triangle, rectangle, oval, diamond, star, heart, pentagon, hexagon, crescent, arrow
- 14 objects: apple, banana, sun, moon, cloud, flower, tree, fish, ball, house, car, egg, cup (+ star/heart aliases)
- 12 named colours: red, blue, yellow, green, orange, purple, pink, brown, black, white, grey/gray
- 144 colour+shape combos possible

**Flow:**
1. K worksheet generates with [IMAGE: red circle] tags etc.
2. `loadKWorksheetImages` checks `_kHardcodedSVG(prompt)` first
3. If match → returns SVG data URL, caches in `_kImageCache`, swaps into DOM instantly
4. If no match → falls through to Flux (existing flow)
5. PDF export path uses same cache transparently

**Moat positioning:** "The only K worksheet tool where triangles are actually triangles, every time." MagicSchool uses limited clipart library. Chalkie has same Flux issues. This is genuine differentiation.

**Matcher unit-tested**: 18/18 cases pass including edge cases like "a big red apple", "ONE YELLOW STAR".

---

## Known Issues / Recurring Bug Patterns

### Flux baking text into images (3+ incidents)
- "What you sey?" (typo'd question on blocks)
- "HOLD UP ROINE / TONE" (toonie with baked text)
- Counter mismatches (10 counters prompt → 6 shown)

AG mitigated by using topic-only prompts for Mindson cover. Not fully solved for content slides. Possible structural fixes (deferred):
- Upgrade to Flux Dev (~5× cost, better instruction following)
- Post-gen OCR check + regenerate if text detected
- Move cover art to illustration library

### Prompt quote-nesting failures (pattern)
- AE fixed lesson_plan, AF fixed answer_key
- Root cause: `"[placeholder]"` with literal quotes inside JSON string field
- Sonnet 4.6 refuses to produce content when quote-nesting risks JSON invalidity
- **Rule for future prompts**: NEVER wrap template placeholders in quote characters

### Answer key regex strictness (fixed AG+)
- Long-form keys without `->` separator fell through to plain paragraph styling
- Now handles both `Q1: question -> answer` and `Q7 (Long answer — Level 3 key points): rubric-style description`

---

## Pending Backlog (Deferred Code Work)

Priority order. **Do not start these without explicit user direction** — priority may have shifted from the Facebook post results.

1. **Refactor rubric to JSON output** (~1 hour)
   - Eliminates class of markdown-format bugs permanently
   - Like slide spec — structured JSON, deterministic rendering
   - Worth doing once before any new rubric features

2. **Centralize `TA_MODEL` constant** (~5 min)
   - 10 hardcoded `claude-sonnet-4-6` refs → 1 constant
   - Makes next model swap a 1-line change
   - Low risk, do when next model upgrade pressure arrives

3. **Auto-delete worksheet_submissions older than school year**
   - Supabase scheduled job
   - Calendar reminder July 1, 2026
   - MFIPPA compliance improvement

4. **Unify two overload error formatters**
   - generate-4.js + client catch both hardcode messages independently
   - Low priority cosmetic

5. **Post-processing OCR check for Flux text-baking**
   - Tesseract.js or similar in worker
   - If baked text detected, regenerate with modified prompt
   - Addresses recurring Flux issue above

6. **Hybrid Flux Schnell/Dev**
   - Schnell for content slides (cheap)
   - Dev for Mindson cover only (quality)
   - ~5× cost on just the hero shot

7. **Subscribe to Anthropic changelog or build 20-line model-availability checker**
   - Don't rely on Claude to surface new models
   - Small scheduled job checking API for new model IDs

8. **Beta code mechanism**
   - Currently `plan='beta'` is set manually in Supabase
   - Future: UI flow where user redeems code → plan updates
   - Enables Facebook post to include redeemable codes

9. **Sentry or client error logging**
   - Currently no observability on what teachers hit
   - Feedback button exists but relies on users reporting
   - Sentry free tier would capture JS errors automatically

---

## Tonight's Task (Fresh Chat Recommended)

User plans to draft a Facebook post for his 5,300-teacher YRDSB (York Region District School Board) group where he is admin. Goal: 10-15 new beta testers.

**Opening context for new session:**

> Solo dev building TeacherAI (teacherai.ca) for Ontario K-8 teachers. Product is in strong beta state. MFIPPA-compliant. Already have 1 active beta tester. Ready to post to my 5,300-teacher YRDSB Facebook group where I'm admin. Goal: 10-15 new beta testers. Help me draft a post that's not cringe, leads with pain not features, and invites real feedback.

User prefers direct, non-cringe tone. Start with pain point ("Tired of Sunday nights making rubrics?"), not feature list. Show don't tell — include screenshot or 30-second demo if possible. Include call for honest feedback.

---

## Tomorrow's Post-Launch Monitoring

When teachers start trickling in:

1. **Morning check** — Anthropic usage page. If curve is steeper than expected ($100 cap approaching), come back for scaling response.
2. **Feedback table in Supabase** — new entries indicate what teachers surfaced. User has feedback button on site.
3. **Watch for 429 errors in Vercel logs** — rate limiter engaging is FINE, but volume matters.
4. **RLS test** — if possible, have one teacher friend try to access another teacher's data (expected: blocked).

**Scaling triggers:**
- >50 signups in 24h: consider raising Anthropic cap to $200
- >200 signups: upgrade Supabase to Pro ($25/mo) for better connection pooling
- Sustained >10 gens/hour: consider upgrading Vercel Hobby → Pro

---

## Critical Lessons from Development

### Never ship without verification
Build T shipped broken for 2 sessions before user caught it (worksheet submissions silently failed). Every build needs production smoke test before layering more changes.

### Diagnostic logging beats guessing
AD diagnostic logging solved the empty lesson_plan mystery in one repro. When a bug is mysterious, add logging first, fix second.

### Ask "what specifically looks wrong"
Spent 2 builds (AG, AG+) on wrong rubric problem because assumed content issues when real problem was layout/grid overflow. When user says "still broken," ask them to point at the exact issue before patching.

### Bug discovery rate doesn't drop with more solo testing
User caught ~7 bugs per session, consistently across 10+ sessions. Fresh eyes testing (non-user teacher) is the fastest path to surfacing the next layer.

### Prompt changes need verification
Rubric prompt tightening (AG) was supposed to fix preamble. Turned out prompt fix wasn't the issue — CSS grid overflow was. Always verify fresh generation actually exhibits the improvement before declaring victory.

---

## Smoke Test Checklist (Run Before Each Deploy)

1. Generate a Gr 3 Math lesson — lesson plan fills, rubric 4 levels on 1 row, answer key populates
2. Generate a Gr 3 Science lesson — same checks plus confirm no "Before/During Reading" labels appear
3. Generate a K shapes worksheet — shapes render instantly (hardcoded SVGs), no Flux delay
4. Build slides — no baked text on Mindson image, coins visible and distinct
5. Download worksheet PDF — activities don't orphan titles across pages
6. Open student worksheet link → submit as roster-matched student → confirm submission appears in teacher dashboard
7. Auto-mark submission → verify scores populate

If all 7 pass, build is safe to ship.

---

## End Note

User had a genuinely productive 2-day sprint. Product is in solid state. Next inflection point is the Facebook post — real user feedback beats solo iteration from this point forward.

When starting a new session, reference this doc for state. Update the build ledger and file state table as new builds ship.
