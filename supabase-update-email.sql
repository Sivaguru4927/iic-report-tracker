-- =====================================================================
-- Update: adds the faculty Email column to Departments & faculty.
-- Run ONCE in Supabase → SQL Editor → New query → Run,
-- only if you already ran supabase-setup.sql before this update.
-- (A fresh setup with the new supabase-setup.sql already includes this.)
-- =====================================================================

alter table public.departments add column if not exists email text;

alter table public.departments drop constraint if exists departments_email_check;
alter table public.departments add constraint departments_email_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- The public submission page may read only these columns (never email)
revoke select on public.departments from anon;
grant select (id, type, name, faculty, mobile, created_at) on public.departments to anon;
