-- =====================================================================
-- UPDATE: AI report check (SETUP.md Step 10).
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- Needs the Drive update (supabase-update-drive.sql) to be in place already.
-- =====================================================================
alter table public.reports add column if not exists ai_score      int;           -- AI report check (Step 10)
alter table public.reports add column if not exists ai_decision   text;
alter table public.reports add column if not exists ai_review     jsonb;
alter table public.reports add column if not exists ai_checked_at timestamptz;
alter table public.reports add column if not exists ai_attempts   int not null default 0;

notify pgrst, 'reload schema';
select 'AI check columns installed' as result;
