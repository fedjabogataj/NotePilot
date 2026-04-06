-- ================================================
-- NOTEPILOT DATABASE SCHEMA
-- ================================================


-- ================================================
-- EXTENSIONS
-- ================================================
create extension if not exists vector;


-- ================================================
-- COURSES
-- ================================================
create table courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text,
  description text,
  semester text,
  created_at timestamptz default now()
);


-- ================================================
-- BOOKS
-- ================================================
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  title text not null,
  author text,
  isbn text,
  edition text,
  publisher text,
  published_year int,
  file_url text,
  cover_url text,
  notes text,
  created_at timestamptz default now()
);


-- ================================================
-- BOOK CHUNKS
-- Each row is one chunk of a book (e.g. a paragraph or ~500-token passage).
-- The embedding column is filled asynchronously after upload via Edge Function.
-- ================================================
create table book_chunks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books(id) on delete cascade,

  content text not null,
  embedding vector(1536),                   -- null until embedded (async job)

  chunk_index int not null,                 -- order within the book
  page_number int,                          -- page this chunk starts on
  chapter text,                             -- chapter heading if extractable
  section text,                             -- sub-section heading if extractable

  created_at timestamptz default now(),

  unique (book_id, chunk_index)
);


-- ================================================
-- LECTURE SLIDES
-- ================================================
create table lecture_slides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  lecture_number int,
  file_url text,
  content_text text,
  uploaded_at timestamptz default now()
);


-- ================================================
-- LECTURE SLIDE CHUNKS
-- Each row is one text block extracted from a slide deck.
-- slide_number is the page/slide index (1-based).
-- bounding box values are fractions (0.0–1.0) of the slide dimensions,
-- so they are resolution-independent and work with PDF.js or any
-- canvas-based renderer. Null if extraction could not determine position.
-- ================================================
create table lecture_slide_chunks (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references lecture_slides(id) on delete cascade,

  content text not null,
  chunk_index int not null,                 -- order within the whole deck

  slide_number int not null,                -- which slide/page (1-based)
  element_type text,                        -- 'heading', 'body', 'caption', 'bullet', etc.

  bbox_x float,                             -- left edge as fraction of slide width
  bbox_y float,                             -- top edge as fraction of slide height
  bbox_width float,
  bbox_height float,

  created_at timestamptz default now(),

  unique (slide_id, chunk_index)
);


-- ================================================
-- NOTES (per lecture)
-- ================================================
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  slide_id uuid references lecture_slides(id) on delete set null,
  title text,
  content text not null,
  is_llm_generated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ================================================
-- EXERCISES
-- ================================================
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  slide_id uuid references lecture_slides(id) on delete set null,
  title text not null,
  description text,
  solution text,
  difficulty text,
  is_completed boolean default false,
  created_at timestamptz default now()
);


-- ================================================
-- EXAMS
-- ================================================
create table exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  exam_date date,
  file_url text,
  content_text text,
  notes text,
  created_at timestamptz default now()
);


-- ================================================
-- AI MODELS
-- A shared reference table of AI models used to generate content.
-- Readable by all authenticated users, not user-owned.
-- ================================================
create table ai_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- e.g. "claude-sonnet-4-5", "gpt-4o"
  provider text,                           -- e.g. "Anthropic", "OpenAI"
  created_at timestamptz default now()
);


-- ================================================
-- CENTRAL NOTES
-- ================================================
create table central_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  last_generated_at timestamptz,
  generation_model_id uuid references ai_models(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ================================================
-- CENTRAL NOTE SEGMENTS
-- A segment is a meaningful block of content (e.g. a paragraph or section).
-- ================================================
create table central_note_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  central_note_id uuid not null references central_notes(id) on delete cascade,

  position int not null,
  content text not null,                   -- always in sync: reconstructed from spans in order

  -- Primary authorship of the segment as a whole
  author_type text not null check (author_type in ('user', 'ai', 'source')),

  -- Quick flag so the UI can show a mixed-authorship badge without inspecting every span
  has_user_modifications boolean default false,

  label text,                              -- optional freeform label, e.g. "summary", "key insight"

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ================================================
-- CENTRAL NOTE SEGMENT SPANS
--
-- A span is an inline sub-part of a segment. Spans are what enable
-- fine-grained authorship tracking within a single segment.
--
-- author_type drives which FK columns must be populated:
--
--   'user'   → ref_user_id must be set, all others null
--   'ai'     → ref_ai_model_id must be set, all others null
--   'source' → ref_slide_id or ref_book_id or ref_exercise_id must be set (exactly one),
--              and the corresponding chunk FK (ref_slide_chunk_id or ref_book_chunk_id)
--              should also be set when available for precise navigation
--
-- When a user edits part of an AI-generated segment, that region becomes
-- a new span with author_type='user', while surrounding untouched regions
-- remain as 'ai' spans. The original AI text is preserved in original_content.
-- ================================================
create table central_note_segment_spans (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references central_note_segments(id) on delete cascade,

  position int not null,                   -- order within the parent segment
  content text not null,                   -- the actual text of this span

  -- What kind of author produced this span
  author_type text not null check (author_type in ('user', 'ai', 'source')),

  -- ---- Author / source reference FK columns ----
  -- Exactly one group must be populated, determined by author_type.

  -- user
  ref_user_id         uuid references auth.users(id) on delete set null,

  -- ai
  ref_ai_model_id     uuid references ai_models(id) on delete set null,

  -- source (parent resource)
  ref_slide_id        uuid references lecture_slides(id) on delete set null,
  ref_book_id         uuid references books(id) on delete set null,
  ref_exercise_id     uuid references exercises(id) on delete set null,

  -- source (precise chunk, for click-to-navigate)
  -- populated when available; null for older spans or when bbox extraction failed
  ref_slide_chunk_id  uuid references lecture_slide_chunks(id) on delete set null,
  ref_book_chunk_id   uuid references book_chunks(id) on delete set null,

  -- If this span was originally AI-generated and then replaced by a user edit,
  -- the AI's original text is preserved here for the authorship diff view
  original_content text,

  label text,                              -- e.g. "corrected", "expanded", "from slides p.12"

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- When author_type = 'user': ref_user_id must be set, all source/ai FKs null
  constraint span_user_ref check (
    author_type != 'user' or (
      ref_user_id is not null and
      ref_ai_model_id is null and
      ref_slide_id is null and
      ref_book_id is null and
      ref_exercise_id is null and
      ref_slide_chunk_id is null and
      ref_book_chunk_id is null
    )
  ),

  -- When author_type = 'ai': ref_ai_model_id must be set, all source/user FKs null
  constraint span_ai_ref check (
    author_type != 'ai' or (
      ref_ai_model_id is not null and
      ref_user_id is null and
      ref_slide_id is null and
      ref_book_id is null and
      ref_exercise_id is null and
      ref_slide_chunk_id is null and
      ref_book_chunk_id is null
    )
  ),

  -- When author_type = 'source':
  --   - user/ai FKs must be null
  --   - exactly one of the three source parent FKs must be set
  --   - chunk FKs may only be set when their matching parent FK is also set
  constraint span_source_ref check (
    author_type != 'source' or (
      ref_user_id is null and
      ref_ai_model_id is null and
      (ref_slide_id is not null)::int +
      (ref_book_id is not null)::int +
      (ref_exercise_id is not null)::int = 1
    )
  ),

  -- Chunk FKs must agree with their parent FKs:
  -- ref_slide_chunk_id only allowed when ref_slide_id is also set
  constraint span_slide_chunk_coherence check (
    ref_slide_chunk_id is null or ref_slide_id is not null
  ),

  -- ref_book_chunk_id only allowed when ref_book_id is also set
  constraint span_book_chunk_coherence check (
    ref_book_chunk_id is null or ref_book_id is not null
  )
);


-- ================================================
-- CENTRAL NOTE SEGMENT SOURCES
-- Segment-level source tracking (independent of span authorship).
-- Records which materials were fed to the AI when generating a segment.
-- ================================================
create table central_note_segment_sources (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references central_note_segments(id) on delete cascade,

  slide_id    uuid references lecture_slides(id) on delete set null,
  book_id     uuid references books(id) on delete set null,
  exercise_id uuid references exercises(id) on delete set null,

  page_reference text,                     -- e.g. "p. 42", "Chapter 3"

  created_at timestamptz default now(),

  constraint exactly_one_source check (
    (slide_id is not null)::int +
    (book_id is not null)::int +
    (exercise_id is not null)::int = 1
  )
);


-- ================================================
-- EVENTS
-- ================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  exam_id uuid references exams(id) on delete set null,
  exercise_id uuid references exercises(id) on delete set null,
  title text not null,
  description text,
  event_type text not null check (
    event_type in (
      'exam', 'exercise_start', 'exercise_deadline',
      'project_start', 'project_deadline',
      'group_registration_deadline', 'lecture', 'quiz', 'other'
    )
  ),
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_all_day boolean default false,
  location text,
  is_completed boolean default false,
  reminder_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ================================================
-- INDEXES
-- ================================================

-- courses
create index on courses(user_id);

-- books
create index on books(user_id);
create index on books(course_id);

-- book_chunks
create index on book_chunks(book_id);
create index on book_chunks(page_number);
create index on book_chunks using hnsw (embedding vector_cosine_ops);

-- lecture_slides
create index on lecture_slides(user_id);
create index on lecture_slides(course_id);

-- lecture_slide_chunks
create index on lecture_slide_chunks(slide_id);
create index on lecture_slide_chunks(slide_number);

-- notes
create index on notes(user_id);
create index on notes(course_id);
create index on notes(slide_id);

-- exercises
create index on exercises(user_id);
create index on exercises(course_id);

-- exams
create index on exams(user_id);
create index on exams(course_id);

-- ai_models
create index on ai_models(name);

-- central_notes
create index on central_notes(user_id);
create index on central_notes(course_id);

-- central_note_segments
create index on central_note_segments(central_note_id);
create index on central_note_segments(user_id);
create index on central_note_segments(position);

-- central_note_segment_spans
create index on central_note_segment_spans(segment_id);
create index on central_note_segment_spans(position);
create index on central_note_segment_spans(ref_user_id);
create index on central_note_segment_spans(ref_ai_model_id);
create index on central_note_segment_spans(ref_slide_id);
create index on central_note_segment_spans(ref_book_id);
create index on central_note_segment_spans(ref_exercise_id);
create index on central_note_segment_spans(ref_slide_chunk_id);
create index on central_note_segment_spans(ref_book_chunk_id);

-- central_note_segment_sources
create index on central_note_segment_sources(segment_id);
create index on central_note_segment_sources(slide_id);
create index on central_note_segment_sources(book_id);
create index on central_note_segment_sources(exercise_id);

-- events
create index on events(user_id);
create index on events(course_id);
create index on events(starts_at);
create index on events(event_type);


-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================
alter table courses enable row level security;
alter table books enable row level security;
alter table book_chunks enable row level security;
alter table lecture_slides enable row level security;
alter table lecture_slide_chunks enable row level security;
alter table notes enable row level security;
alter table exercises enable row level security;
alter table exams enable row level security;
alter table ai_models enable row level security;
alter table central_notes enable row level security;
alter table central_note_segments enable row level security;
alter table central_note_segment_spans enable row level security;
alter table central_note_segment_sources enable row level security;
alter table events enable row level security;


-- courses
create policy "Users can manage their own courses"
  on courses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- books
create policy "Users can manage their own books"
  on books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- book_chunks: access is derived from the parent book's owner
create policy "Users can manage their own book chunks"
  on book_chunks for all
  using (
    exists (
      select 1 from books b
      where b.id = book_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from books b
      where b.id = book_id and b.user_id = auth.uid()
    )
  );

-- lecture_slides
create policy "Users can manage their own slides"
  on lecture_slides for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- lecture_slide_chunks: access is derived from the parent slide's owner
create policy "Users can manage their own slide chunks"
  on lecture_slide_chunks for all
  using (
    exists (
      select 1 from lecture_slides s
      where s.id = slide_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from lecture_slides s
      where s.id = slide_id and s.user_id = auth.uid()
    )
  );

-- notes
create policy "Users can manage their own notes"
  on notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exercises
create policy "Users can manage their own exercises"
  on exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- exams
create policy "Users can manage their own exams"
  on exams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ai_models: shared reference table, read-only for all authenticated users
create policy "Authenticated users can read ai_models"
  on ai_models for select
  using (auth.role() = 'authenticated');

-- central_notes
create policy "Users can manage their own central notes"
  on central_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- central_note_segments
create policy "Users can manage their own central note segments"
  on central_note_segments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- central_note_segment_spans: access derived from the parent segment's owner
create policy "Users can manage their own spans"
  on central_note_segment_spans for all
  using (
    exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  );

-- central_note_segment_sources: access derived from the parent segment's owner
create policy "Users can manage their own segment sources"
  on central_note_segment_sources for all
  using (
    exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  );

-- events
create policy "Users can manage their own events"
  on events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ================================================
-- HELPER QUERIES (for reference, not executed)
-- ================================================

-- Semantic search across a user's books:
--
-- select
--   b.title,
--   b.author,
--   c.page_number,
--   c.chapter,
--   c.content,
--   1 - (c.embedding <=> $query_embedding) as similarity
-- from book_chunks c
-- join books b on b.id = c.book_id
-- where b.user_id = $user_id
--   and b.course_id = $course_id
-- order by c.embedding <=> $query_embedding
-- limit 10;


-- Click-to-navigate: resolve a span to its exact slide position:
--
-- select
--   ls.file_url,
--   lsc.slide_number,
--   lsc.bbox_x,
--   lsc.bbox_y,
--   lsc.bbox_width,
--   lsc.bbox_height,
--   lsc.content
-- from central_note_segment_spans sp
-- join lecture_slide_chunks lsc on lsc.id = sp.ref_slide_chunk_id
-- join lecture_slides ls on ls.id = lsc.slide_id
-- where sp.id = $span_id;