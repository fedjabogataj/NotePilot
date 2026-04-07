-- Phase 2: Material upload support
-- Adds processing status tracking to books, lecture_slides, and exams.
-- Creates the private materials storage bucket with RLS policies.

-- ── Processing status columns ────────────────────────────────────────

alter table books
  add column processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_error text;

alter table lecture_slides
  add column processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_error text;

-- Exams are uploaded for reference only — no text extraction needed.
alter table exams
  add column processing_status text not null default 'ready'
    check (processing_status in ('pending', 'processing', 'ready', 'failed')),
  add column processing_error text;


-- ── Materials storage bucket ─────────────────────────────────────────
-- Private bucket — files are accessed via presigned URLs only.
-- File paths are structured as: {user_id}/{type}/{record_id}/{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  52428800,   -- 50 MiB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint'
  ]
)
on conflict (id) do nothing;


-- ── Storage RLS ───────────────────────────────────────────────────────
-- The first path segment is always the owner's user_id UUID.

create policy "Users can upload their own materials"
  on storage.objects for insert
  with check (
    bucket_id = 'materials' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own materials"
  on storage.objects for select
  using (
    bucket_id = 'materials' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own materials"
  on storage.objects for update
  using (
    bucket_id = 'materials' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own materials"
  on storage.objects for delete
  using (
    bucket_id = 'materials' and
    auth.uid()::text = (storage.foldername(name))[1]
  );
