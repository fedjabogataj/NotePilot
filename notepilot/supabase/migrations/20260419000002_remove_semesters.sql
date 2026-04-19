-- Remove semester concept from the data model.
-- Semesters were freeform text fields; folder hierarchy replaces them.

alter table courses drop column if exists semester;
alter table folders drop column if exists semester;
