-- =====================================================================
-- UPDATE: new reports in bold in All reports (like unread mail) until a coordinator opens them.
-- A report counts as read once a coordinator opens or downloads its file, changes its verification or remarks,
-- or clicks "Mark as read". A corrected file uploaded by the department makes it unread (bold) again.
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- =====================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'reports' and column_name = 'seen_at') then
    alter table public.reports add column seen_at timestamptz;
    -- reports already decided count as read; only those still waiting start in bold
    -- (the report guard and email triggers are paused for this one update: it changes nothing else)
    alter table public.reports disable trigger user;
    update public.reports set seen_at = now() where verification <> 'Pending Verification';
    alter table public.reports enable trigger user;
  end if;
end $$;

-- a new file (a corrected report) makes the report unread again
create or replace function public.reports_mark_unread()
returns trigger language plpgsql as $$
begin
  if new.file_path is distinct from old.file_path then new.seen_at := null; end if;
  return new;
end;
$$;
drop trigger if exists reports_mark_unread on public.reports;
create trigger reports_mark_unread
  before update on public.reports
  for each row execute function public.reports_mark_unread();

notify pgrst, 'reload schema';
select 'Unread reports installed' as result;
