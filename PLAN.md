# NotePilot — Implementation Plan

_Last updated: April 2026_

## Current State

### Done

- **Auth**: Email/password login & signup via Supabase SSR
- **Courses**: Full CRUD — create, edit, delete, semester grouping
- **Material upload**: Books (PDF), slides (PDF/PPT), exams (PDF) with metadata, drag-and-drop, signed URLs, 50 MB limit
- **PDF processing**: Server-side text extraction via pdf2json, chunking (2000-char for books, per-slide for slides), processing status tracking (pending → processing → ready/failed)
- **Sidebar**: Notion-style tree — Home → semesters → courses → folders → materials, with context menus, plus buttons, folder CRUD, move-to-folder
- **Folders**: Recursive folder hierarchy at home, semester, and course levels
- **Material viewer**: Iframe-based PDF viewer with presigned URLs
- **Breadcrumb navigation**: Context-aware breadcrumb bar at top of content area
- **Unified add-item panel**: Single page for adding any item type from any context
- **Database schema**: All 15 tables created with RLS, indexes, and vector columns ready

### Not Started (database tables exist, no UI or logic)

- Embeddings & semantic search
- AI note generation (central notes)
- Per-lecture notes
- Exercises
- Calendar / events
- Search UI

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| Backend | Next.js server actions + Supabase Edge Functions (async) |
| Database | Supabase PostgreSQL + pgvector |
| Storage | Supabase Storage (private bucket, signed URLs) |
| AI | Anthropic Claude (note generation), OpenAI text-embedding-3-small (embeddings) |
| PDF parsing | pdf2json (server-side) |

---

## Phases

### Phase 2 — Embeddings & Search

**Goal:** Generate vector embeddings for all text chunks and build semantic search.

- [ ] Install `@anthropic-ai/sdk` or use existing `openai` package for embeddings
- [ ] Create embedding generation logic: batch-process chunks from `book_chunks` and `lecture_slide_chunks` where `embedding IS NULL`, call OpenAI `text-embedding-3-small`, write 1536-dim vectors back
- [ ] Trigger embedding generation after `processBook` / `processLectureSlide` completes
- [ ] Update `processing_status` to `ready` only after all chunks have embeddings
- [ ] Build search server action: embed query → cosine similarity against both chunk tables filtered by `course_id` → return top-K results with page refs
- [ ] Build search UI: search input per course, results list with passage text + page number + source material link
- [ ] PDF viewer deep-link: click search result → open viewer scrolled to relevant page

### Phase 3 — AI Central Notes

**Goal:** Generate comprehensive study notes from all course materials using Claude.

- [ ] Install `@anthropic-ai/sdk`
- [ ] Build retrieval pipeline: generate synthetic topic embedding (course name + description) → top-40 chunks from each chunk table by cosine similarity → re-rank combined set → trim to context window
- [ ] Build prompt template: system prompt for synthesis (not summarization), structured JSON output (segments + spans), source chunk references, prioritize slides over books
- [ ] Build streaming endpoint: `POST /api/generate-note` → streams Anthropic response as newline-delimited JSON
- [ ] Persist spans as stream arrives: each line → insert into `central_note_segments` / `central_note_segment_spans` with `author_type='ai'`, source FK
- [ ] Build central notes UI:
  - [ ] "Generate Notes" button on course page
  - [ ] Live streaming render of note segments
  - [ ] Inline citation markers linking to source chunks
  - [ ] Click citation → side panel with source passage + jump to PDF viewer location
- [ ] Build span editing: click span to edit, flips `author_type` to `user`, preserves `original_content`
- [ ] Rate limiting: max 5 generation requests/hour/course

### Phase 4 — Per-Lecture Notes & Exercises

**Goal:** Manual note-taking per lecture and exercise tracking.

- [ ] Build notes UI:
  - [ ] Rich text editor (TipTap) for per-lecture notes
  - [ ] Notes list per course, optionally linked to a slide deck
  - [ ] Server actions: createNote, updateNote, deleteNote
- [ ] Build exercises UI:
  - [ ] Exercise CRUD: title, description, difficulty, solution
  - [ ] Completion tracking with filterable list
  - [ ] Server actions: createExercise, updateExercise, deleteExercise
- [ ] Integrate notes and exercises into sidebar tree

### Phase 5 — Calendar & Events

**Goal:** Track exams, deadlines, and lectures.

- [ ] Build calendar UI component (month/week view)
- [ ] Event CRUD: create/edit/delete events with type, datetime, location
- [ ] Event types: exam, exercise deadline, project deadline, lecture, quiz, other
- [ ] Auto-create events from exam records and exercise deadlines
- [ ] Server actions: createEvent, updateEvent, deleteEvent
- [ ] Reminder/notification support (optional)

### Phase 6 — Polish

- [ ] Regeneration with diff review before overwriting user-edited spans
- [ ] Export central notes to PDF and Markdown
- [ ] Onboarding flow for new users
- [ ] Performance audit: slow queries, RLS scan checks, HNSW index usage via EXPLAIN ANALYZE
- [ ] Mobile-responsive layout
- [ ] Keyboard shortcuts (Cmd+K search, navigation)

### Phase 7 — Stretch Goals

- [ ] Quiz generation from central notes
- [ ] Multi-language support
- [ ] Collaboration mode (shared central notes — requires RLS model changes)
- [ ] Slide image OCR for non-text-layer content

---

## Database Tables

| Table | Status | Used By |
|-------|--------|---------|
| `courses` | Active | Course CRUD, sidebar |
| `books` | Active | Material upload & viewer |
| `book_chunks` | Chunks populated, embeddings empty | Phase 2 |
| `lecture_slides` | Active | Material upload & viewer |
| `lecture_slide_chunks` | Chunks populated | Phase 2 |
| `exams` | Active | Material upload & viewer |
| `folders` | Active | Sidebar folder tree |
| `notes` | Schema only | Phase 4 |
| `exercises` | Schema only | Phase 4 |
| `events` | Schema only | Phase 5 |
| `ai_models` | Schema only | Phase 3 |
| `central_notes` | Schema only | Phase 3 |
| `central_note_segments` | Schema only | Phase 3 |
| `central_note_segment_spans` | Schema only | Phase 3 |
| `central_note_segment_sources` | Schema only | Phase 3 |

---

## Key Architecture Decisions

- **RLS-first security**: All data access goes through Supabase RLS policies. Server actions add defense-in-depth ownership checks.
- **Sync/async split**: User interactions use Next.js server actions (sync). PDF processing and embedding generation are async (triggered after upload).
- **Granular authorship**: Central note spans track `author_type` (ai/user), `original_content` vs `current_content`, and source chunk FKs — enables regeneration without losing user edits.
- **Flexible folders**: Folders are independent of courses and can exist at home, semester, or course level with unlimited nesting.
- **Private storage**: All files in private Supabase Storage bucket; access only via time-limited signed URLs generated server-side after ownership verification.
