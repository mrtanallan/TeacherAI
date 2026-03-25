# TeacherAI — Ontario SSC Teacher OS
## Project Brief & Build Continuity Document
*Last updated: March 25, 2026*

---

## PRODUCT OVERVIEW

**Product name:** TeacherAI
**Domain:** teacherai.ca (live)
**Live site:** https://teacherai.ca
**GitHub repo:** github.com/mrtanallan/TeacherAI
**Built by:** Allan (Ontario SSC teacher, Toronto)
**Current version:** v3.0 · Mar 25 2026 (shown in footer after login)

**What TeacherAI is:**
An AI-powered teaching operating system built specifically for Ontario elementary teachers — with a focus on SSC (Self-Contained Special Education) classrooms and split/multi-grade classes. It takes a teacher from lesson planning → student worksheet delivery → student submission → AI auto-marking → assessment → report card comments, all in one place.

**What makes it different from competitors (e.g. Chalkie.ai):**
- Ontario 2023 curriculum aligned (Language/Literacy, K–8, all strands)
- Supports up to 6-grade split/multi-grade classes in one lesson
- IEP/modified expectations aware — generates differentiated content per student
- Full assessment loop: Level 1−/L1/1+ marking, AI auto-marking with per-question feedback, grade tracker, feedback generation
- Student worksheet submission with fuzzy name matching (no student accounts needed)
- AI answer key generated alongside every lesson for auto-marking
- Persistent data via Supabase (Canadian servers)
- Teacher login and account system
- No competitor has the complete SSC workflow

**The teacher (Allan):**
- Ontario SSC teacher in Toronto
- Teaches split grades (up to 4 grades simultaneously: e.g. 4/5, 6/7, 7/8)
- Has students with IEPs/modified expectations
- Uses Google Classroom (board gApps account — board-restricted OAuth)
- Students use Chromebooks/laptops

---

## CURRENT TECH STACK

| Component | Technology | Details |
|---|---|---|
| Frontend | HTML/CSS/JS | Single file: public/index.html (~220KB) |
| Backend | Vercel Serverless | api/generate.js — proxies to Anthropic |
| Student worksheets | Vercel Serverless | api/worksheet.js — fetch/submit worksheets |
| AI | Anthropic Claude API | claude-sonnet-4-20250514 |
| Hosting | Vercel | teacherai.ca (custom domain) |
| Source control | GitHub | github.com/mrtanallan/TeacherAI |
| Database | Supabase | Canadian region (ca-central-1) |
| Auth | Supabase Auth | Email/password teacher login |

**File structure on GitHub:**
```
TeacherAI/
├── api/
│   ├── generate.js       ← proxies to Anthropic API (auth + rate limiting)
│   └── worksheet.js      ← fetch worksheet + save submissions
├── public/
│   ├── index.html        ← main teacher app (~220KB, all-in-one)
│   ├── worksheet.html    ← student-facing worksheet page
│   ├── privacy.html      ← privacy policy
│   └── terms.html        ← terms of service
├── vercel.json
└── README.md
```

**IMPORTANT — index.html is too large for GitHub web editor.**
Use GitHub → public/ folder → Add file → Upload files to replace index.html.
Other files (worksheet.html, api/*.js) can use the pencil editor.

**Vercel environment variables:**
- ANTHROPIC_API_KEY
- SUPABASE_URL = https://bbhhkyiyfybmlfkerfto.supabase.co
- SUPABASE_ANON_KEY = eyJhbGci... (long JWT)
- SUPABASE_SERVICE_KEY = sb_secret_... (for worksheet.js)

**Supabase project:** TeacherAI (bbhhkyiyfybmlfkerfto.supabase.co)
**Supabase region:** Canada Central 🇨🇦

---

## DATABASE SCHEMA (Supabase)

```sql
profiles          -- teacher accounts (auto-created on signup)
  id, email, full_name, class_context(text), created_at

classes           -- class groups per teacher
  id, teacher_id, name, subject_focus, context(text), created_at
  -- NOTE: grades are NOT stored on classes — derived from students

students          -- class roster per teacher
  id, teacher_id, class_id(nullable), first_name, last_name, grade,
  notes, learning_profile, created_at, previous_class_name(text)

lessons           -- saved generated lessons
  id, teacher_id, topic, grades[], subject, content(jsonb),
  expectations(jsonb), created_at

worksheets        -- shareable student worksheets
  id, teacher_id, lesson_id, topic, grades[], subject,
  content(text JSON), roster(jsonb), class_id(nullable), created_at
  -- content JSON format: { worksheet, reading, grades_content?, answer_key?, answer_keys? }
  -- grades_content: { "Grade 4": "...", "Grade 5": "..." } for split links
  -- answer_keys: { "Grade 4": "...", "Grade 5": "..." } for split auto-marking

worksheet_submissions  -- student responses
  id, worksheet_id, student_name, student_id(nullable),
  responses(jsonb), submitted_at

assessment_sessions   -- assessment events
  id, teacher_id, task, subject, strand, grades[], date,
  class_id(nullable), expectations(jsonb), created_at

student_marks         -- per-student marks per session
  id, session_id, student_id, level, notes, created_at
```

All tables have Row Level Security (RLS) enabled.
Teachers only see their own data.
Worksheet submissions are publicly writable (students have no accounts).

---

## CURRENT FEATURES (Built & Live as of v3.0)

### Authentication
- Email/password signup and login
- Auto-profile creation on signup
- Persistent session across browser closes
- Sign out
- Auth check (Bearer JWT) on all API calls

### Navigation Tabs
- 📅 Plan & Teach | 👥 Class Roster | 📊 Assessment | 📚 My Lessons | 📝 Report Cards | 🎯 Expectations
- Tab state persists via localStorage
- Switching tabs auto-refreshes relevant data

### Multiple Classes
- Create/edit/delete classes with name, subject focus, context notes (optional)
- Active class shown with ✓ checkmark tab
- Class selector in Daily Workflow Step 1
- Students filtered by active class

### Class Roster
- Add students: first name, last name, grade, accommodation notes, learning profile
- Grades auto-fill in Step 1 from students in active class
- Learning Profile field = teacher's professional notes / modified expectations (NOT full IEP)
- MFIPPA privacy tip shown in roster

### Daily Workflow (5-step process)
1. **Plan** — Select class (auto-fills grades), up to 6 grades, subject, topic, duration, literacy strands, outputs, target expectations (collapsible)
2. **Review & Edit** — All generated content editable; Reset to original
3. **Share** — Student Worksheet link (Edit + PDF + Get Link buttons); PDF download for other content
4. **Assess** — Per-student Level 1−/L1/1+ tap buttons, observation notes, submitted work inline, 🤖 Auto-mark button
5. **Feedback** — AI-generated Ontario-style descriptive feedback per student

### Generation
- Token limits: 3200 / 5000 / 7000 based on number of grades
- Animated progress bar with dynamic stage labels (based on selected outputs)
- Auto-retry on 529 overload errors (3 retries, 3s/6s/12s backoff)
- Answer key generated silently alongside every worksheet (used for auto-marking)
- Output order: Lesson Plan → Reading Resource → Worksheets → Rubric → Differentiation

### Generation Outputs
- Lesson Plan (timing, Minds On/Action/Consolidation)
- Student Worksheet (interactive input fields)
- Reading Resource (original 200-300 word passage)
- Assessment Rubric (Ontario Level 1/2/3/4 table)
- Differentiation & Modified Expectations (opt-in)
- Answer Key (internal, not shown to students)
- Ontario 2023 Expectations (auto-matched)

### Worksheet Markers
`[TEXT BOX]`, `[LARGE BOX]`, `[CIRCLE ONE: A/B/C]`, `[CHECK ALL THAT APPLY: A/B/C]`, `[WORD BANK: w1,w2]`, `[DIAGRAM: description]`
All matching is case-insensitive. Name/Date header handled by platform — not generated by AI.

### Student Worksheet Delivery
- One combined link for split classes (student picks grade) OR per-grade links
- Student types name → fuzzy match (Dice coefficient)
- Grade picker removed after submission
- Combined link cached per session (same ID for all grade buttons)

### AI Auto-Marking (NEW in v3.0)
- 🤖 Auto-mark button appears when student has submitted AND answer key exists
- Sends responses + answer key + rubric to Claude
- Returns: suggested level (L1–L4), per-question ✓/~/✗ feedback shown inline on each Q&A row
- Student-friendly observation note addressed by first name — auto-saved to notes field
- "📋 Copy to notes" button for easy copy
- Level pre-filled with dashed border (AI suggestion, not confirmed)
- Teacher clicks any level to confirm; Save Assessment saves the final mark
- Re-mark button available; note tracked for report card use

### Slides Generation (📊 button in edit blocks)
- Full slide deck: Title → Learning Goals → Minds On → Vocabulary → Content slides → Discussion → Activity → Exit Ticket → **Anchor Chart** → Closing
- Anchor chart slide: formatted for copying onto chart paper for classroom walls
- Unsplash images fetched for visual interest
- Token limit: 3500

### Assessment (Step 4)
- Submissions fetched only from worksheets created on or after session date (prevents stale data from same-topic lessons)
- Per-question feedback shown inline when auto-marked
- Observation note auto-populated from AI suggestion

### Grade Tracker (Assessment tab)
- **Class tab bar** — All Classes tab + one tab per class, proper underline tab UI
- Active class label shown below tabs
- All Classes view adds Class column to student table
- Stats: students, sessions, class average, count at Level 4
- Per-student average level table with drill-down history
- Recent sessions list with Edit marks + Delete
- Delete session removes from local state instantly (no refresh needed)
- CSV export, Export All Data button

### My Lessons tab
- Search by topic/subject/grade
- Sort by date/subject/grade/topic A-Z
- **Bulk select + delete** (☑️ Select button)
- Better empty state with CTA
- Click to reload any past lesson into workflow
- Answer keys restored from lesson content on reload

### Report Cards tab
- AI-generated Ontario-style report card comments
- Uses accumulated assessment data and expectations
- Sorted A-Z by last name to match PowerSchool order

### Expectations tab
- 96 Ontario 2023 expectations embedded
- Tracker shows all expectations covered across saved lessons

### Footer
- 🇨🇦 Data stored in Canada · Privacy Policy · Terms of Service · Contact
- **Version number: v3.0 · Mar 25 2026** — check after login to confirm deploy

---

## PRIVACY & COMPLIANCE

**Data flow:**
- Student names → NEVER sent to Anthropic. Anonymized as "Student A, B, C"
- Learning profiles (modified expectations) → sent to Anthropic anonymized
- Assessment data → Supabase only, never to Anthropic
- Student worksheet responses → Supabase only, never to Anthropic
- Everything stored in Canada (Supabase ca-central-1)

**Key privacy decisions:**
- "Learning Profile" framing (not "IEP upload")
- First name + modified expectations only — no DOB, diagnosis, psychological data
- No student accounts — students access via link only
- Worksheet page has zero TeacherAI branding
- MFIPPA tip shown in roster: use first names or pseudonyms

---

## GOOGLE CLASSROOM STRATEGY

Board-issued gApps accounts have OAuth restrictions.

**Current approach:**
- Student worksheet: unique URL teacher pastes into GC as assignment link
- No Google OAuth required anywhere
- Share step shows Edit + PDF + Link buttons for each worksheet

---

## DEPLOYMENT WORKFLOW

**For index.html (too large for web editor, ~220KB):**
1. Download index.html from Claude
2. GitHub → TeacherAI repo → public/ folder → Add file → Upload files
3. Drop index.html → Commit changes
4. Vercel auto-deploys in ~30-45 seconds
5. Log in → check footer version number to confirm correct version is live

**For smaller files (worksheet.html, api/*.js):**
1. GitHub → file → pencil icon → Cmd+A → paste → Commit changes

**Always wait for green checkmark on GitHub before testing.**

---

## PLANNED FEATURES (Priority Order)

### Phase 2 — Next
- [ ] Google OAuth login (personal Gmail, not board account)
- [ ] Stripe subscription ($9.99-14.99/month)
- [ ] Usage limits per tier
- [ ] Prompt caching (reduce API costs + latency)
- [ ] Haiku for slides (faster, cheaper, less 529 risk)
- [ ] End-to-end incognito test with fresh teacher account

### Phase 3 — Growth
- [ ] School board vendor package
- [ ] Curriculum tracker expansion (Math, Science, etc.)
- [ ] Export to Google Slides
- [ ] React rewrite for maintainability
- [ ] Mobile app (PWA)

---

## COMPETITIVE POSITIONING

**vs Chalkie.ai ($4M funded, 500K teachers):**
- Chalkie: generic, global, slide-focused, no Ontario curriculum, no SSC, no assessment, no auto-marking
- TeacherAI: Ontario-specific, SSC/split grade, IEP-aware, complete assessment loop, AI auto-marking, student submission

**TeacherAI's moat:**
1. SSC/split grade workflow (up to 6 grades) — nobody else has this
2. IEP differentiation built into generation
3. Complete lesson → submission → AI marking → assessment → report card loop
4. Ontario 2023 curriculum — Language/Literacy K–8
5. Student submission without Google OAuth
6. Data stored in Canada (MFIPPA-conscious)

---

## MONETIZATION PLAN

**Phase 1 (now):** Free for teacher friends — gather feedback
**Phase 2:** $9.99-14.99/month per teacher (Stripe)
**Phase 3:** School/board pricing

**Cost per generation:** ~$0.03-0.11 depending on grades and outputs selected
**Auto-mark cost:** ~$0.01 per student marked
**Hosting:** Vercel free tier
**Database:** Supabase free tier

---

## KEY DECISIONS LOG

- Chose Vercel over Replit (free tier never sleeps, better for production)
- Chose Supabase (Canadian data residency, free tier, RLS built in, auth built in)
- Student names anonymized (Student A, B, C) before any Anthropic API call
- "Learning Profile" not "IEP upload" — privacy-defensible framing
- No student accounts — students access via link only
- Fuzzy name matching (Dice coefficient) + prefix match
- Unmatched submissions still save (never loses data)
- PDF download for teacher content (lesson plan, rubric)
- No TeacherAI branding on student worksheet page
- Grades derived from student records — NOT stored separately on class definition
- Combined worksheet link cached per session (same DB record for all grade buttons)
- Submission matching filtered by worksheet creation date (prevents stale data)
- Answer key generated silently alongside every lesson (stored in worksheet content)
- Auto-mark uses student name in observation note prompt for personalized feedback
- 529 overload: retryAuthFetch with 3 retries, 3/6/12s backoff, teacher-friendly messages
- Progress bar stages built dynamically from selected outputs
- Grade tracker class tabs: proper tab bar with All Classes option
- Lesson deletion: removes from local state immediately for instant UI update
- index.html ~220KB — use GitHub file upload, not web editor
- Version number in footer (after login) to confirm deploys
- teacheraicanada@gmail.com for contact

## HOW TO USE THIS DOCUMENT IN A NEW CLAUDE SESSION

Upload this file to the Claude conversation (or paste it).

Say: "Here is the full brief for TeacherAI, an Ontario teacher tool I'm building. Please read it carefully and then [your request]."

Claude will then have full context and can continue building without starting from scratch.
