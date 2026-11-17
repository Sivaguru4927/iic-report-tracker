-- =====================================================================
-- UPDATE FOR AN EXISTING SETUP (31 Oct 2026)
-- Adds: Queries / Difficulties field (field 10) + Queries tab.
-- Run ONCE in Supabase -> SQL Editor -> New query -> paste all -> Run.
-- Safe to run again. Your departments and reports are not changed.
-- =====================================================================


alter table public.reports add column if not exists email text;

-- Optional question / difficulty raised by the department
alter table public.reports add column if not exists query text;
alter table public.reports drop constraint if exists reports_query_check;
alter table public.reports add constraint reports_query_check check (query is null or length(query) <= 1000);

-- Month the activity took place, as YYYY-MM (e.g. 2026-10)
alter table public.reports add column if not exists month text;
alter table public.reports drop constraint if exists reports_month_check;
alter table public.reports add constraint reports_month_check
  check (month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

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
  if tg_op = 'UPDATE' and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;


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

alter table public.reports add column if not exists query text;

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

