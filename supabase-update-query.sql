-- =====================================================================
-- Update: "Queries / Difficulties" field on the submission page.
-- Run ONCE in Supabase -> SQL Editor -> New query -> Run,
-- only if you set up the tracker before this update.
-- If you installed email notifications, ALSO run
-- supabase-email-notifications.sql again afterwards (your settings are kept),
-- and paste the new Code.gs into your Apps Script and redeploy.
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
    if new.month > to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') then
      raise exception 'The activity month cannot be in the future.';
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
