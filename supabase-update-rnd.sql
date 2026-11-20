-- =====================================================================
-- UPDATE: Prescribed R&D activities in the "Activity type" list (field 8).
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- =====================================================================
alter table public.reports add column if not exists iic_activity text;
alter table public.reports drop constraint if exists reports_iic_activity_check;
alter table public.reports add constraint reports_iic_activity_check
  check (iic_activity is null or iic_activity ~ '^(cal\|Quarter [1-4]\|[1-9]|day\|[0-1][0-9]-[0-3][0-9]|nirf\|[A-Z]{2,4}\.[A-Z]{2,6}|nisp\|N[0-9]{1,2}|rnd\|R[0-9]{1,2}|other)$');

notify pgrst, 'reload schema';
select 'R&D activity types installed' as result;
