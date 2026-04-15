-- Make folders independent of courses:
--   1. Drop the NOT NULL constraint on course_id
--   2. Change ON DELETE CASCADE → ON DELETE SET NULL so deleting a course
--      doesn't cascade-delete folders that may belong to a semester or home
--   3. Add a nullable semester text column so folders can be scoped to a
--      semester without being tied to any specific course

ALTER TABLE folders ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_course_id_fkey;
ALTER TABLE folders
  ADD CONSTRAINT folders_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE folders ADD COLUMN semester text;
