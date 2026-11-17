-- =====================================================================
-- DASHBOARD UPDATE (Nov 2026) — ONE script for an existing setup.
-- Adds: Activity type on reports (IIC calendar / celebrations / NIRF Innovation / NISP),
--       NISP & NIRF status table with Target month, all months of the IIC year
--       in "Month of activity".
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run.
-- Safe to run more than once. Your departments and reports are not changed.
-- =====================================================================

-- columns earlier updates added (skipped if they are already there)
alter table public.reports add column if not exists email text;
alter table public.reports add column if not exists month text;
alter table public.reports add column if not exists query text;

-- Activity type on reports + NISP / NIRF status table
alter table public.reports add column if not exists iic_activity text;
alter table public.reports drop constraint if exists reports_iic_activity_check;
alter table public.reports add constraint reports_iic_activity_check
  check (iic_activity is null or iic_activity ~ '^(cal\|Quarter [1-4]\|[1-9]|day\|[0-1][0-9]-[0-3][0-9]|nirf\|[A-Z]{2,4}\.[A-Z]{2,6}|nisp\|N[0-9]{1,2}|other)$');

create table if not exists public.compliance (
  id         text primary key,            -- '<IIC year>:<item code>', e.g. '2026:P7.2', '2026:N1'
  year       integer not null,
  code       text not null,
  status     text not null default 'Not started' check (status in ('Not started','In progress','Achieved','Not applicable')),
  value      text not null default '' check (length(value) <= 300),
  remarks    text not null default '' check (length(remarks) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.compliance enable row level security;
drop policy if exists "admins manage compliance" on public.compliance;
create policy "admins manage compliance" on public.compliance
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- target month for NISP / NIRF items (gap analysis on the Dashboard)
alter table public.compliance add column if not exists target text not null default '';
alter table public.compliance drop constraint if exists compliance_target_check;
alter table public.compliance add constraint compliance_target_check check (target ~ '^([0-9]{4}-[0-9]{2})?$');


-- reports tagged with the old NIRF codes (P1.1 … P7.5) are no longer used
delete from public.compliance where code ~ '^P[0-9]';

-- 'Month of activity' can be any month of the current IIC year (Sep–Aug), or the previous year
alter table public.reports add column if not exists drive_id text;   -- Google Drive file (Step 9)
alter table public.reports add column if not exists drive_url text;
alter table public.reports add column if not exists ai_score      int;           -- AI report check (Step 10)
alter table public.reports add column if not exists ai_decision   text;
alter table public.reports add column if not exists ai_review     jsonb;
alter table public.reports add column if not exists ai_checked_at timestamptz;
alter table public.reports add column if not exists ai_attempts   int not null default 0;
alter table public.reports add column if not exists formatted boolean not null default false;   -- formatted by the AI formatting agent on upload

-- true when the request comes from the Google Apps Script with the service_role key (moves files to Drive)
create or replace function public.is_service()
returns boolean language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

-- Reports for a month are accepted during that month and for GRACE days after it (10th of the next month, IST)
create or replace function public.report_window(p_month text, out opens date, out closes date)
language sql stable
as $$
  select to_date(p_month || '-01', 'YYYY-MM-DD'),
         (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month' + interval '9 days')::date;   -- 9 = last open day is the 10th
$$;

create or replace function public.reports_guard()
returns trigger
language plpgsql security definer set search_path = public, storage
as $$
declare
  v_email text;
  v_ay    int;
begin
  if tg_op = 'INSERT' and not public.is_admin() then
    new.mobile := null;
    select d.mobile, nullif(trim(d.email), '') into new.mobile, v_email
      from public.departments d
     where d.type = new.type and d.name = new.dept and d.faculty = new.faculty;
    if new.mobile is null then
      raise exception 'This department and faculty are not on the list. Contact the CII&E office.';
    end if;
    if v_email is not null then
      new.email := lower(v_email);
    else
      new.email := lower(trim(coalesce(new.email, '')));
      if new.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'Enter a valid email address.';
      end if;
    end if;
    if new.month is null or new.month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Choose the month of the activity.';
    end if;
    -- any month of the current IIC year (Sep–Aug), or of the previous one for late reports
    v_ay := extract(year from now() at time zone 'Asia/Kolkata')::int
            - case when extract(month from now() at time zone 'Asia/Kolkata') < 9 then 1 else 0 end;
    if new.month < (v_ay - 1)::text || '-09' or new.month > (v_ay + 1)::text || '-08' then
      raise exception 'Choose a month of this IIC year (or last year).';
    end if;
    -- submission window: the month itself, then until the 10th of the next month (India time)
    if (now() at time zone 'Asia/Kolkata')::date < (public.report_window(new.month)).opens then
      raise exception 'Reports for % can be submitted from 1 %.', to_char(to_date(new.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'),
        to_char(to_date(new.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY');
    end if;
    if (now() at time zone 'Asia/Kolkata')::date > (public.report_window(new.month)).closes then
      raise exception 'The last date for % reports was %. Late reports are uploaded only by the CII&E coordinator.', to_char(to_date(new.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY'),
        to_char((public.report_window(new.month)).closes, 'FMDD FMMonth YYYY');
    end if;
    -- IIC year Sep–Aug: Sep–Nov Q1, Dec–Feb Q2, Mar–May Q3, Jun–Aug Q4
    if new.quarter is distinct from
       'Quarter ' || ((((substr(new.month, 6, 2)::int - 9 + 12) % 12) / 3) + 1) then
      raise exception 'The month does not belong to the chosen quarter.';
    end if;
    if new.file_path not like new.id::text || '/%' then
      raise exception 'Invalid file reference.';
    end if;
    if not exists (select 1 from storage.objects o
                    where o.bucket_id = 'iic-reports' and o.name = new.file_path) then
      raise exception 'The Word file did not finish uploading. Please try again.';
    end if;
    new.submission   := 'Submitted';
    new.verification := 'Pending Verification';
    new.remarks      := '';
    new.query        := nullif(trim(coalesce(new.query, '')), '');
    new.created_at   := now();
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() and not public.is_service() then
    raise exception 'Not allowed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard
  before insert or update on public.reports
  for each row execute function public.reports_guard();

-- make the website see the new columns straight away
notify pgrst, 'reload schema';

select 'Dashboard update installed' as result;
