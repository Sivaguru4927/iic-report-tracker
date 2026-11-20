-- =====================================================================
-- UPDATE: "Submit the corrected report" link in the Returned for Correction email.
-- The link opens the submission page for THAT report; the department uploads the corrected Word file,
-- which replaces the old one (same report, same Drive folder; the old Drive file goes to the bin),
-- and the report goes back to Pending Verification (the AI agent checks it again).
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- =====================================================================
create extension if not exists pgcrypto;

alter table public.reports add column if not exists edit_token uuid not null default gen_random_uuid();  -- secret in the email link
alter table public.reports add column if not exists resubmit_count int not null default 0;
alter table public.reports add column if not exists resubmitted_at timestamptz;
alter table public.reports add column if not exists drive_prev_id text;   -- old Drive file, removed once the corrected one is in Drive
alter table public.reports add column if not exists formatted boolean not null default false;
alter table public.reports add column if not exists ai_score      int;
alter table public.reports add column if not exists ai_decision   text;
alter table public.reports add column if not exists ai_review     jsonb;
alter table public.reports add column if not exists ai_checked_at timestamptz;
alter table public.reports add column if not exists ai_attempts   int not null default 0;
alter table public.reports add column if not exists drive_id text;
alter table public.reports add column if not exists drive_url text;

-- the report guard, now letting resubmit_report() update the one report it was called for
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

-- what the correction page shows (only with the secret from the email)
drop function if exists public.report_for_correction(uuid, uuid);
create function public.report_for_correction(p_id uuid, p_token uuid)
returns table (id uuid, type text, dept text, faculty text, quarter text, month text, title text, file_name text,
               created_at timestamptz, verification text, remarks text, resubmit_count int)
language sql stable security definer set search_path = public
as $$
  select r.id, r.type, r.dept, r.faculty, r.quarter, r.month, r.title, r.file_name, r.created_at, r.verification,
         r.remarks, r.resubmit_count
    from public.reports r
   where r.id = p_id and r.edit_token = p_token;
$$;
revoke execute on function public.report_for_correction(uuid, uuid) from public;
grant  execute on function public.report_for_correction(uuid, uuid) to anon, authenticated;

-- replace the report's file with the corrected one (uploaded first to iic-reports/<report id>/...)
drop function if exists public.resubmit_report(uuid, uuid, text, text, bigint, boolean);
create function public.resubmit_report(p_id uuid, p_token uuid, p_file_path text, p_file_name text,
                                       p_file_size bigint, p_formatted boolean)
returns text
language plpgsql security definer set search_path = public, storage
as $$
declare r public.reports;
begin
  select * into r from public.reports where id = p_id and edit_token = p_token for update;
  if not found then raise exception 'This correction link is not valid. Use the latest email, or contact the CII&E office.'; end if;
  if r.verification = 'Verified' then raise exception 'This report has already been verified. No correction is needed.'; end if;
  if r.verification = 'Rejected' then raise exception 'This report was not accepted. Please contact the CII&E office.'; end if;
  if p_file_path is null or p_file_path not like p_id::text || '/%' or p_file_path = r.file_path then
    raise exception 'Invalid file reference.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'iic-reports' and o.name = p_file_path) then
    raise exception 'The Word file did not finish uploading. Please try again.';
  end if;
  perform set_config('iic.resubmit', p_id::text, true);
  update public.reports set
    file_path = p_file_path, file_name = left(coalesce(p_file_name, 'report.docx'), 200), file_size = p_file_size,
    formatted = coalesce(p_formatted, false),
    drive_prev_id = case when r.drive_id is not null and r.drive_id <> 'missing' then r.drive_id else r.drive_prev_id end,
    drive_id = null, drive_url = null,
    verification = 'Pending Verification', remarks = '',
    ai_score = null, ai_decision = null, ai_review = null, ai_checked_at = null, ai_attempts = 0,
    resubmit_count = r.resubmit_count + 1, resubmitted_at = now()
  where id = p_id;
  perform set_config('iic.resubmit', '', true);
  return 'ok';
end;
$$;
revoke execute on function public.resubmit_report(uuid, uuid, text, text, bigint, boolean) from public;
grant  execute on function public.resubmit_report(uuid, uuid, text, text, bigint, boolean) to anon, authenticated;

-- the emails: "Submit the corrected report" carries the link; a corrected upload is acknowledged
create or replace function public.reports_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  rcpt text[] := public.report_recipients(new.type, new.dept, new.faculty, new.email);
  info jsonb := jsonb_build_object(
    'type', new.type, 'dept', new.dept, 'faculty', new.faculty, 'quarter', new.quarter,
    'title', new.title, 'fileName', new.file_name,
    'submittedAt', to_char(new.created_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM'),
    'verification', new.verification, 'remarks', coalesce(new.remarks, ''),
    'query', coalesce(new.query, ''),
    'reportId', new.id, 'editToken', new.edit_token, 'resubmitted', coalesce(new.resubmit_count, 0) > 0,
    'activityMonth', case when new.month ~ '^[0-9]{4}-[0-9]{2}$'
                          then to_char(to_date(new.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY') else '' end);
begin
  if tg_op = 'INSERT' then
    perform public.queue_mail('submitted', rcpt,
      'Acknowledgement · ' || new.dept || ' · ' || new.quarter || ' · ' || new.title, new.id, info);
  elsif coalesce(new.resubmit_count, 0) > coalesce(old.resubmit_count, 0) then          -- corrected report uploaded
    perform public.queue_mail('submitted', rcpt,
      'Corrected report received · ' || new.dept || ' · ' || new.quarter || ' · ' || new.title, new.id, info);
  elsif new.verification is distinct from old.verification
        and new.verification in ('Verified', 'Returned for Correction', 'Rejected') then
    perform public.queue_mail('status', rcpt,
      new.verification || ' · ' || new.dept || ' · ' || new.quarter || ' · ' || new.title, new.id, info);
  end if;
  return null;
end;
$$;

notify pgrst, 'reload schema';
select 'Corrected-report link installed' as result;
