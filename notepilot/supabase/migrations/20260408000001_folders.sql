-- Add folders table with recursive nesting support
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON folders FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add folder_id to material tables (null = course root)
ALTER TABLE books ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE lecture_slides ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
