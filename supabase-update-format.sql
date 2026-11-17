-- =====================================================================
-- UPDATE: AI formatting agent — marks reports whose Word file was formatted to the CII&E style on upload.
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- =====================================================================
alter table public.reports add column if not exists formatted boolean not null default false;   -- formatted by the AI formatting agent on upload

notify pgrst, 'reload schema';
select 'Formatting column installed' as result;
