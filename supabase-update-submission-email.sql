-- =====================================================================
-- Update: Email field on the department submission page.
-- Run ONCE in Supabase -> SQL Editor -> New query -> Run,
-- only if you set up the tracker before this update.
-- If you had installed email notifications, ALSO run
-- supabase-email-notifications.sql again afterwards (your settings are kept).
-- =====================================================================

-- Faculty email column on departments (in case the earlier update wasn't run)
alter table public.departments add column if not exists email text;

-- The submission page shows the faculty email
grant select (id, type, name, faculty, mobile, email, created_at) on public.departments to anon;

-- Email given on the submission page (filled from the faculty record when one exists)
alter table public.reports add column if not exists email text;
alter table public.reports drop constraint if exists reports_email_check;
alter table public.reports add constraint reports_email_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

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
    new.created_at   := now();
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

