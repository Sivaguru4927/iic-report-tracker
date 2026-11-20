-- =====================================================================
-- IIC REPORT TRACKER — Supabase setup
-- Run this whole file ONCE in Supabase: SQL Editor → New query → Run.
-- It is safe to run again later (it updates rather than duplicates).
--
-- BEFORE RUNNING: change the admin email on the last lines of this file
-- if you want a different login than ecell@psgcas.ac.in.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Admins: only emails listed here can open the tracker
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Departments with faculty and mobile number
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('Aided','SF')),
  name       text not null check (length(trim(name)) between 1 and 150),
  faculty    text not null check (length(trim(faculty)) between 1 and 120),
  mobile     text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  unique (type, name, faculty)
);

-- Faculty email (added later; safe to run on an existing database)
alter table public.departments add column if not exists email text;
alter table public.departments drop constraint if exists departments_email_check;
alter table public.departments add constraint departments_email_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- The public submission page may read only these columns
-- (email is shown there so faculty can see where their acknowledgement goes)
revoke select on public.departments from anon;
grant select (id, type, name, faculty, mobile, email, created_at) on public.departments to anon;

-- ---------------------------------------------------------------------
-- 3. Reports
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('Aided','SF')),
  dept         text not null,
  faculty      text not null,
  mobile       text,
  quarter      text not null check (quarter in ('Quarter 1','Quarter 2','Quarter 3','Quarter 4')),
  title        text not null check (length(trim(title)) between 1 and 300),
  file_path    text not null,
  file_name    text not null,
  file_size    integer,
  submission   text not null default 'Submitted'
               check (submission in ('Submitted','Not Submitted','In Progress')),
  verification text not null default 'Pending Verification'
               check (verification in ('Pending Verification','Verified','Returned for Correction','Rejected')),
  remarks      text not null default '' check (length(remarks) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Guard: a department submission can only create a "Submitted /
-- Pending Verification" report for a real department + faculty, with a
-- Word file it actually uploaded. Mobile is always taken from the
-- departments table, never from the form.
-- Email given on the submission page (filled from the faculty record when one exists)
alter table public.reports add column if not exists email text;
alter table public.reports drop constraint if exists reports_email_check;
alter table public.reports add constraint reports_email_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- Optional question / difficulty raised by the department
alter table public.reports add column if not exists query text;
alter table public.reports drop constraint if exists reports_query_check;
alter table public.reports add constraint reports_query_check check (query is null or length(query) <= 1000);

-- Month the activity took place, as YYYY-MM (e.g. 2026-10)
alter table public.reports add column if not exists month text;
alter table public.reports drop constraint if exists reports_month_check;
alter table public.reports add constraint reports_month_check
  check (month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

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
  if tg_op = 'UPDATE' and not public.is_admin() and not public.is_service()
     and coalesce(current_setting('iic.resubmit', true), '') <> new.id::text then   -- corrected file sent through resubmit_report()
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

-- What a department sees about its own reports (no mobile numbers).
drop function if exists public.department_reports(text, text);
create function public.department_reports(p_type text, p_dept text)
returns table (id uuid, month text, quarter text, title text, faculty text, file_name text,
               created_at timestamptz, verification text, remarks text, query text)
language sql stable security definer set search_path = public
as $$
  select r.id, r.month, r.quarter, r.title, r.faculty, r.file_name, r.created_at, r.verification, r.remarks, r.query
    from public.reports r
   where r.type = p_type and r.dept = p_dept
   order by coalesce(r.month, to_char(r.created_at, 'YYYY-MM')) desc, r.created_at desc;
$$;
grant execute on function public.department_reports(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Row level security (who can do what)
-- ---------------------------------------------------------------------
alter table public.admins      enable row level security;
alter table public.departments enable row level security;
alter table public.reports     enable row level security;

drop policy if exists "admins can see admin list" on public.admins;
create policy "admins can see admin list" on public.admins
  for select to authenticated using (public.is_admin());

drop policy if exists "everyone can read departments" on public.departments;
create policy "everyone can read departments" on public.departments
  for select to anon, authenticated using (true);

drop policy if exists "admins manage departments" on public.departments;
create policy "admins manage departments" on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone can submit a report" on public.reports;
create policy "anyone can submit a report" on public.reports
  for insert to anon, authenticated with check (true);   -- reports_guard enforces the rules

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
  for select to authenticated using (public.is_admin());

drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete reports" on public.reports;
create policy "admins delete reports" on public.reports
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. Storage bucket for the Word files (private, .docx only, 5 MB max)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('iic-reports', 'iic-reports', false, 5242880,
        array['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can upload report files" on storage.objects;
create policy "anyone can upload report files" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'iic-reports');

drop policy if exists "admins read report files" on storage.objects;
create policy "admins read report files" on storage.objects
  for select to authenticated using (bucket_id = 'iic-reports' and public.is_admin());

drop policy if exists "admins delete report files" on storage.objects;
create policy "admins delete report files" on storage.objects
  for delete to authenticated using (bucket_id = 'iic-reports' and public.is_admin());

-- ---------------------------------------------------------------------
-- 6. Live updates on the tracker when a department submits
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.reports;
exception when duplicate_object then null;
          when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 6a. Queries / Difficulties: departments that cannot submit, or need help
-- ---------------------------------------------------------------------
create table if not exists public.queries (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid references public.reports(id) on delete set null,
  type       text not null check (type in ('Aided','SF')),
  dept       text not null,
  faculty    text not null,
  mobile     text,
  email      text,
  quarter    text,
  month      text,
  title      text,
  query      text not null check (length(trim(query)) between 1 and 1000),
  status     text not null default 'Open' check (status in ('Open','In Progress','Resolved')),
  reply      text not null default '' check (length(reply) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.queries_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  if tg_op = 'INSERT' and not public.is_admin() then
    new.mobile := null;
    select d.mobile, nullif(trim(d.email), '') into new.mobile, v_email
      from public.departments d
     where d.type = new.type and d.name = new.dept and d.faculty = new.faculty;
    if new.mobile is null then
      raise exception 'This department and faculty are not on the list. Contact the CII&E office.';
    end if;
    new.email := lower(coalesce(v_email, nullif(trim(new.email), '')));
    if new.email is null or new.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Enter a valid email address.';
    end if;
    if new.report_id is not null and not exists
       (select 1 from public.reports r where r.id = new.report_id and r.type = new.type and r.dept = new.dept) then
      new.report_id := null;
    end if;
    new.query      := trim(new.query);
    new.title      := nullif(trim(coalesce(new.title, '')), '');
    new.status     := 'Open';
    new.reply      := '';
    new.created_at := now();
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists queries_guard on public.queries;
create trigger queries_guard before insert or update on public.queries
  for each row execute function public.queries_guard();

-- What a department sees about its own queries
create or replace function public.department_queries(p_type text, p_dept text)
returns table (id uuid, quarter text, month text, title text, faculty text, query text,
               created_at timestamptz, status text, reply text)
language sql stable security definer set search_path = public
as $$
  select q.id, q.quarter, q.month, q.title, q.faculty, q.query, q.created_at, q.status, q.reply
    from public.queries q
   where q.type = p_type and q.dept = p_dept
   order by q.created_at desc;
$$;
grant execute on function public.department_queries(text, text) to anon, authenticated;

alter table public.queries enable row level security;
drop policy if exists "anyone can send a query" on public.queries;
create policy "anyone can send a query" on public.queries
  for insert to anon, authenticated with check (true);     -- queries_guard enforces the rules
drop policy if exists "admins read queries" on public.queries;
create policy "admins read queries" on public.queries
  for select to authenticated using (public.is_admin());
drop policy if exists "admins update queries" on public.queries;
create policy "admins update queries" on public.queries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete queries" on public.queries;
create policy "admins delete queries" on public.queries
  for delete to authenticated using (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.queries;
exception when duplicate_object then null;
          when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- 6b. IIC calendar tag on reports + NISP / NIRF status (Dashboard)
-- ---------------------------------------------------------------------
alter table public.reports add column if not exists iic_activity text;
alter table public.reports drop constraint if exists reports_iic_activity_check;
alter table public.reports add constraint reports_iic_activity_check
  check (iic_activity is null or iic_activity ~ '^(cal\|Quarter [1-4]\|[1-9]|day\|[0-1][0-9]-[0-3][0-9]|nirf\|[A-Z]{2,4}\.[A-Z]{2,6}|nisp\|N[0-9]{1,2}|rnd\|R[0-9]{1,2}|other)$');

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

-- ---------------------------------------------------------------------
-- 7. Your admin login email (change or add more lines as needed)
-- ---------------------------------------------------------------------
insert into public.admins (email) values ('ecell@psgcas.ac.in')
on conflict (email) do nothing;

notify pgrst, 'reload schema';
