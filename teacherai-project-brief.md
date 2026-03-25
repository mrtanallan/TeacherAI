# TeacherAI — Ontario SSC Teacher OS
## Project Brief & Build Continuity Document
*Last updated: March 25, 2026 — end of day*

---

## PRODUCT OVERVIEW

**Product name:** TeacherAI
**Tagline:** "Stop spending evenings planning. AI lesson plans, auto-marking & report card comments — built for Ontario teachers."
**Domain:** teacherai.ca (live)
**GitHub repo:** github.com/mrtanallan/TeacherAI
**Built by:** Allan (Ontario teacher, Toronto)
**Current version:** v3.5 · Mar 25 2026 (shown in footer after login)

**What TeacherAI is:**
An AI-powered teaching OS for Ontario elementary teachers. Full loop: lesson planning → student worksheet → submission → AI auto-marking → assessment → report card comments. Built for split-grade and SSC classrooms with Ontario 2023 curriculum alignment.

---

## TECH STACK

| Component | Technology |
|---|---|
| Frontend | HTML/CSS/JS — single file public/index.html (~230KB) |
| Backend | Vercel Serverless — api/generate.js (Anthropic proxy) |
| Student worksheets | Vercel Serverless — api/worksheet.js |
| AI | claude-sonnet-4-20250514 |
| Hosting | Vercel — teacherai.ca |
| Database | Supabase — ca-central-1 (Canadian) |
| Auth | Supabase Auth — email/password + Google OAuth |

**IMPORTANT — index.html is too large for GitHub web editor.**
GitHub → public/ → Add file → Upload files. Other files use pencil editor.

**Vercel env vars:** ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
**Supabase:** bbhhkyiyfybmlfkerfto.supabase.co

---

## DATABASE SCHEMA

```sql
profiles              -- teacher accounts, auto-created on signup
students              -- id, teacher_id, class_id, first_name, last_name, grade, notes, learning_profile
classes               -- id, teacher_id, name, subject_focus, context
lessons               -- id, teacher_id, topic, grades[], subject, content(jsonb), expectations(jsonb), class_id
worksheets            -- id, teacher_id, lesson_id, topic, grades[], content(text JSON), roster(jsonb), class_id
worksheet_submissions -- id, worksheet_id, student_name, student_id, responses(jsonb), submitted_at
assessment_sessions   -- id, teacher_id, task, subject, strand, grades[], date, class_id, expectations(jsonb)
student_marks         -- id, session_id, student_id, level, notes
```

RLS on all tables. Students submit publicly (no accounts). lessons.class_id added Mar 25 for expectations filtering.

---

## CURRENT FEATURES (v3.5)

### Auth
- Email/password signup + login
- Google OAuth ("Continue with Google") — wired to Supabase
- Password reset — "Forgot password?" link → Supabase sends email
- Bearer JWT on all API calls
- Google Cloud OAuth: authorized origins teacherai.ca + www.teacherai.ca
- Supabase redirect URLs: teacherai.ca + www.teacherai.ca

### Navigation Tabs (in order)
`👥 Class Roster | ✨ Generate | 📚 My Lessons | 📊 Assessment | 🎯 Expectations | 📝 Report Cards | 👤 Account`

### Account Page (👤 icon in nav)
- Edit display name, change password
- Usage stats (lessons / assessments / students / member since)
- Connect Google Drive — links Google identity for email/password users (needs "Allow manual linking" in Supabase)
- Account deletion request

### Onboarding (new teachers)
- 3-step banner: Add Students → Generate → Share
- Steps update live: ✅ Done / 👇 Next / greyed
- Persists until teacher has students AND lessons
- Skip hides for session only; permanently gone only when both steps complete
- Re-checks on Plan tab visit and every login

### Generate Tab (formerly Plan & Teach)
- Class selector → auto-fills grades from students (works on first load, no refresh)
- Up to 6 grades (split/multi-grade SSC)
- Literacy strands: Reading / Writing / Oral / Media — selected strands passed explicitly to expectations prompt
- Outputs: Lesson Plan, Student Worksheet, Reading Resource, Assessment Rubric, Differentiation (opt-in), Answer Key (silent)
- Progress bar with dynamic stage labels
- 529 retry: 3 retries at 3s/6s/12s, teacher-friendly messages
- Usage meter below Generate button (reads from lessons table)

### Output Order
Lesson Plan → Reading Resource → Student Worksheet(s) → Assessment Rubric → Answer Key → Differentiation

### Workflow Steps
1. **Plan** — class, grades, topic, strands, outputs
2. **Review & Edit** — all content editable, Reset to original, grade label on worksheets
3. **📦 Resources** (renamed from Share) — quick access links + PDFs for resharing
4. **Assess** — level buttons, notes, per-student 💾 Save, 🤖 Auto-mark
5. **Feedback** — Ontario descriptive feedback (different from auto-mark note)

### Worksheet Markers (case-insensitive matching)
`[TEXT BOX]` `[LARGE BOX]` `[CIRCLE ONE: A/B/C]` `[CHECK ALL THAT APPLY: A/B]` `[WORD BANK: w1,w2]` `[DIAGRAM: desc]`

### Student Worksheet (worksheet.html)
- Fuzzy name match (Dice coefficient), unmatched still saves
- 🖨️ Print button with comprehensive print CSS
- Submissions filtered by worksheet created_at >= sessionDate

### AI Auto-Marking
- Answer key generated silently with every lesson
- 🤖 button appears when student submitted + answer key exists
- Prompt includes total Q count vs answered count (prevents "attempted all" hallucination)
- Returns: suggested level + per-question ✓/~/✗ inline
- Observation note auto-saves, addressed by student first name
- Re-mark available; per-student 💾 Save button

### Expectations — Strand-Aware
- Selected strands explicitly passed to AI: forces cross-strand connections
- Writing topic + Reading checked → gets both D (Composition) and C (Comprehension) expectations
- Media Literacy → Strand A expectation connecting media to topic
- 96 Ontario 2023 expectations embedded
- Tracker filters by class (class filter dropdown)
- Clickable coverage badge shows which lessons covered each expectation
- Lessons save class_id for filtering

### My Lessons
- Search by topic/subject/grade (live)
- Sort: date / subject / grade / A-Z
- ☑️ Bulk select + delete
- Load past lesson → restores into Generate (including answer keys)

### Report Cards
- Class required (Generate button disabled until class selected)
- Loads ALL students from DB (not filtered by activeClassId)
- Grade filter chains from class; student checkboxes (all checked by default)
- Scope summary: "→ 4 students selected"
- Reporting period changes generated language:
  - Progress → observational, learning skills, no grade refs
  - Term 1 → achievement language, expectations met, next step
  - Term 2 → summative, year-in-review, readiness for next grade
- Sorted A-Z by last name (PowerSchool order)

### Slides
- Full deck with Anchor Chart slide
- Pixabay API for images → Picsum fallback
- Download as .pptx (open in Google Slides via File → Import)

### Grade Tracker
- Class tabs: All Classes + per-class
- Per-student history, averages, drill-down
- Sessions: edit + delete (instant local update)
- CSV export, Export All Data

---

## PRIVACY
- Student names anonymized (Student A, B, C) before every Anthropic call
- Responses + assessment data → Supabase only, never Anthropic
- Canada servers (ca-central-1)
- No student accounts; no TeacherAI branding on worksheet page
- "Learning Profile" not "IEP upload"

---

## GOOGLE OAUTH (configured)
- Google Cloud client: TeacherAI Web
- JS origins: https://teacherai.ca, https://www.teacherai.ca
- Redirect URI: https://bbhhkyiyfybmlfkerfto.supabase.co/auth/v1/callback
- Supabase Site URL: https://teacherai.ca
- Still shows Supabase URL in Google consent screen (cosmetic — needs custom auth domain to fix, not worth it for beta)

---

## EMAIL TEMPLATES (paste into Supabase → Authentication → Email)
- Confirm signup → subject: "Welcome to TeacherAI — confirm your email"
- Reset password → subject: "Reset your TeacherAI password"
- Both use {{ .ConfirmationURL }}
- HTML files in project outputs folder

---

## PENDING BEFORE WIDER SHARING
- [ ] Enable "Allow manual linking" in Supabase (Authentication → Sign In / Providers)
- [ ] Paste email templates into Supabase
- [ ] Delete skyland/skylandreal@gmail.com from Supabase users
- [ ] Mobile test on phone (student worksheet especially)
- [ ] Commit this project brief to GitHub repo

## PHASE 2 (after coworker feedback)
- [ ] Stripe subscription ($9.99-14.99/month)
- [ ] usage_log table + per-user monthly caps
- [ ] Prompt caching (90% cheaper input tokens)
- [ ] Haiku for slides (faster, cheaper)
- [ ] Custom SMTP via Resend.com (noreply@teacherai.ca)
- [ ] Math/Science curriculum

## PHASE 3
- [ ] School board vendor package
- [ ] Google Slides direct export (Drive API)
- [ ] React rewrite

---

## KEY DECISIONS

- Vercel (never sleeps) + Supabase (Canadian, RLS, auth)
- Student names anonymized before every API call
- "Learning Profile" not "IEP" — MFIPPA-defensible
- No student accounts — link-based only
- Fuzzy name match (Dice) — unmatched submissions still save
- Answer key in worksheet content JSON (not separate table)
- Auto-mark prompt includes total Q count vs answered
- 529 retry: retryAuthFetch, 3/6/12s backoff
- _combinedLinkCache: prevents duplicate DB records for split "one link"
- _classIdInitialized: prevents All Classes being overridden
- _rcAllStudents: loads all students for report cards
- progInterval hoisted before try block
- Loading overlay z-index 9999
- Tab order: Roster → Generate → My Lessons → Assessment → Expectations → Report Cards
- Step 3 renamed from "Share" to "📦 Resources"
- Onboarding: skip = session only, permanent = only when both steps done
- Grade auto-fill: fetches from DB if students not in memory
- Usage meter: reads lessons table until usage_log set up with Stripe
- Slides images: Pixabay → Picsum fallback
- Strand-aware expectations: strands array passed to AI prompt explicitly
- class_id saved on lessons (for expectations tracker filter)
- index.html ~230KB — GitHub file upload only

---

## HOW TO USE IN A NEW CLAUDE SESSION

Upload this file and say:
*"Here is the full brief for TeacherAI. Read it carefully then [your request]."*

Always upload the most recent version at the start of each session.
