-- ================================================
-- ADMIN SETUP
-- Creates an admin user and updates RLS policies
-- to grant admins full access to all tables.
--
-- Admin credentials:
--   Email:    admin@notepilot.app
--   Password: Admin#NP2026!
-- ================================================


-- ================================================
-- EXTENSIONS
-- ================================================
create extension if not exists pgcrypto;


-- ================================================
-- HELPER: is_admin()
-- Reads the 'role' claim from app_metadata in the JWT.
-- ================================================
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;


-- ================================================
-- ADMIN USER
-- Inserts directly into auth.users + auth.identities.
-- Skipped if the email already exists.
-- ================================================
do $$
declare
  admin_id uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'admin@notepilot.app') then

    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      aud,
      role,
      raw_user_meta_data,
      raw_app_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@notepilot.app',
      extensions.crypt('Admin#NP2026!', extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      'authenticated',
      'authenticated',
      '{"first_name": "Admin", "last_name": "User"}'::jsonb,
      '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
      false,
      '', '', '', ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', 'admin@notepilot.app'),
      'email',
      admin_id::text,
      now(),
      now(),
      now()
    );

  end if;
end $$;


-- ================================================
-- RLS POLICIES — add admin bypass to all tables
-- Drop and recreate each policy with is_admin() check.
-- ================================================

-- courses
drop policy "Users can manage their own courses" on courses;
create policy "Users can manage their own courses"
  on courses for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- books
drop policy "Users can manage their own books" on books;
create policy "Users can manage their own books"
  on books for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- book_chunks
drop policy "Users can manage their own book chunks" on book_chunks;
create policy "Users can manage their own book chunks"
  on book_chunks for all
  using (
    is_admin() or exists (
      select 1 from books b where b.id = book_id and b.user_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from books b where b.id = book_id and b.user_id = auth.uid()
    )
  );

-- lecture_slides
drop policy "Users can manage their own slides" on lecture_slides;
create policy "Users can manage their own slides"
  on lecture_slides for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- lecture_slide_chunks
drop policy "Users can manage their own slide chunks" on lecture_slide_chunks;
create policy "Users can manage their own slide chunks"
  on lecture_slide_chunks for all
  using (
    is_admin() or exists (
      select 1 from lecture_slides s where s.id = slide_id and s.user_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from lecture_slides s where s.id = slide_id and s.user_id = auth.uid()
    )
  );

-- notes
drop policy "Users can manage their own notes" on notes;
create policy "Users can manage their own notes"
  on notes for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- exercises
drop policy "Users can manage their own exercises" on exercises;
create policy "Users can manage their own exercises"
  on exercises for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- exams
drop policy "Users can manage their own exams" on exams;
create policy "Users can manage their own exams"
  on exams for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- ai_models: admin can write; authenticated users can read
drop policy "Authenticated users can read ai_models" on ai_models;
create policy "Authenticated users can read ai_models"
  on ai_models for select
  using (auth.role() = 'authenticated');
create policy "Admins can manage ai_models"
  on ai_models for all
  using (is_admin())
  with check (is_admin());

-- central_notes
drop policy "Users can manage their own central notes" on central_notes;
create policy "Users can manage their own central notes"
  on central_notes for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- central_note_segments
drop policy "Users can manage their own central note segments" on central_note_segments;
create policy "Users can manage their own central note segments"
  on central_note_segments for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());

-- central_note_segment_spans
drop policy "Users can manage their own spans" on central_note_segment_spans;
create policy "Users can manage their own spans"
  on central_note_segment_spans for all
  using (
    is_admin() or exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  );

-- central_note_segment_sources
drop policy "Users can manage their own segment sources" on central_note_segment_sources;
create policy "Users can manage their own segment sources"
  on central_note_segment_sources for all
  using (
    is_admin() or exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from central_note_segments s
      where s.id = segment_id and s.user_id = auth.uid()
    )
  );

-- events
drop policy "Users can manage their own events" on events;
create policy "Users can manage their own events"
  on events for all
  using (auth.uid() = user_id or is_admin())
  with check (auth.uid() = user_id or is_admin());
