-- =====================================================================
-- IIC Tracker — Email notifications
--   • Acknowledgement email when a department submits a report
--   • Email when you set Verified / Returned for Correction / Rejected
--   • Reminder on the 20th of every month (10:00 AM IST) to departments
--     with no report submitted that month, plus a summary to you
--
-- Run ONCE in Supabase → SQL Editor → New query → Run,
-- AFTER supabase-setup.sql. Safe to run again.
-- Emails are sent through your Google Apps Script (see SETUP.md, Step 8).
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Faculty email column (in case the earlier update wasn't run)
alter table public.departments add column if not exists email text;

-- ---------------------------------------------------------------------
-- Settings (only readable through the admin functions below)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null default ''
);
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values
  ('mail_webhook_url', ''),
  ('mail_secret', replace(gen_random_uuid()::text, '-', '')),
  ('admin_email', 'iic@psgcas.ac.in'),
  ('site_url', 'https://iicactivitytracker.netlify.app'),
  ('reminders_enabled', 'true')
on conflict (key) do nothing;

create or replace function public.setting(k text)
returns text language sql stable security definer set search_path = public
as $$ select value from public.app_settings where key = k $$;

-- ---------------------------------------------------------------------
-- Email log
-- ---------------------------------------------------------------------
create table if not exists public.email_log (
  id         bigserial primary key,
  kind       text not null,
  recipients text[] not null default '{}',
  summary    text,
  report_id  uuid,
  request_id bigint,
  created_at timestamptz not null default now()
);
alter table public.email_log enable row level security;

-- ---------------------------------------------------------------------
-- Hand one email to the Apps Script. Never blocks the report itself.
-- ---------------------------------------------------------------------
create or replace function public.queue_mail(p_kind text, p_to text[], p_summary text, p_report uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare
  u   text := coalesce(public.setting('mail_webhook_url'), '');
  rid bigint;
begin
  if u !~ '^https://script\.google\.com/' then
    insert into public.email_log (kind, recipients, summary, report_id)
    values (p_kind, coalesce(p_to, '{}'), p_summary || ' — not sent: email link not set up yet', p_report);
    return;
  end if;
  select net.http_post(
    url     := u,
    body    := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
                 'kind', p_kind,
                 'to', to_jsonb(coalesce(p_to, '{}'::text[])),
                 'secret', public.setting('mail_secret'),
                 'adminEmail', public.setting('admin_email'),
                 'siteUrl', public.setting('site_url')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 15000
  ) into rid;
  insert into public.email_log (kind, recipients, summary, report_id, request_id)
  values (p_kind, coalesce(p_to, '{}'), p_summary, p_report, rid);
exception when others then
  insert into public.email_log (kind, recipients, summary, report_id)
  values (p_kind, coalesce(p_to, '{}'), p_summary || ' — error: ' || sqlerrm, p_report);
end;
$$;

create or replace function public.faculty_emails(p_type text, p_dept text, p_faculty text)
returns text[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct lower(trim(email))) filter (where coalesce(trim(email), '') <> ''), '{}')
    from public.departments
   where type = p_type and name = p_dept and (p_faculty is null or faculty = p_faculty);
$$;

-- ---------------------------------------------------------------------
-- Submission + verification emails
-- ---------------------------------------------------------------------
alter table public.reports add column if not exists email text;
alter table public.reports add column if not exists month text;
alter table public.reports add column if not exists query text;

-- Faculty emails on record, plus the email typed on the submission page
create or replace function public.report_recipients(p_type text, p_dept text, p_faculty text, p_email text)
returns text[] language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(distinct e), '{}')
    from unnest(public.faculty_emails(p_type, p_dept, p_faculty)
                || case when coalesce(trim(p_email), '') <> '' then array[lower(trim(p_email))] else '{}'::text[] end) as e;
$$;

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

drop trigger if exists reports_notify on public.reports;
create trigger reports_notify
  after insert or update of verification on public.reports
  for each row execute function public.reports_notify();

-- Queries: acknowledgement when a query comes in (copied to the coordinator),
-- and the reply when you mark it Resolved
create or replace function public.queries_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  rcpt text[];
  info jsonb;
begin
  if to_regclass('public.queries') is null then return null; end if;
  rcpt := public.report_recipients(new.type, new.dept, new.faculty, new.email);
  info := jsonb_build_object(
    'type', new.type, 'dept', new.dept, 'faculty', new.faculty, 'quarter', coalesce(new.quarter, ''),
    'activityMonth', case when new.month ~ '^[0-9]{4}-[0-9]{2}$'
                          then to_char(to_date(new.month || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY') else '' end,
    'title', coalesce(new.title, ''), 'query', new.query, 'reply', coalesce(new.reply, ''), 'status', new.status,
    'submittedAt', to_char(new.created_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM'));
  if tg_op = 'INSERT' then
    if new.report_id is null then   -- a query sent with a report is already in the report's acknowledgement
      perform public.queue_mail('query_received', rcpt, 'Query received · ' || new.dept || ' · ' || left(new.query, 60), null, info);
    end if;
  elsif new.status is distinct from old.status and new.status = 'Resolved' then
    perform public.queue_mail('query_reply', rcpt, 'Query resolved · ' || new.dept || ' · ' || left(new.query, 60), null, info);
  end if;
  return null;
end;
$$;
do $$
begin
  if to_regclass('public.queries') is not null then
    execute 'drop trigger if exists queries_notify on public.queries';
    execute 'create trigger queries_notify after insert or update of status on public.queries
             for each row execute function public.queries_notify()';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Monthly reminders: departments with no report submitted this month
-- ---------------------------------------------------------------------
-- One call to the Apps Script carries the whole list; the script sends one email per
-- department and then the summary. (Dozens of separate calls at once can be refused
-- by Google, so they are batched.)
create or replace function public.send_monthly_reminders(p_force boolean default false)
returns integer language plpgsql security definer set search_path = public
as $$
declare
  m_start timestamptz := (date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
  m_label text := to_char(now() at time zone 'Asia/Kolkata', 'FMMonth YYYY');
  u   text := coalesce(public.setting('mail_webhook_url'), '');
  r   record;
  n   integer := 0;
  lst jsonb := '[]'::jsonb;
  rid bigint;
  note text := '';
begin
  if not p_force and coalesce(public.setting('reminders_enabled'), 'true') <> 'true' then
    return 0;
  end if;
  for r in
    select d.type, d.name,
           array_agg(distinct d.faculty order by d.faculty) as facs,
           coalesce(array_agg(distinct lower(trim(d.email))) filter (where coalesce(trim(d.email), '') <> ''), '{}') as emails
      from public.departments d
     where not exists (select 1 from public.reports x
                        where x.type = d.type and x.dept = d.name and x.created_at >= m_start)
     group by d.type, d.name
     order by d.type, d.name
  loop
    n := n + 1;
    lst := lst || jsonb_build_object('type', r.type, 'dept', r.name,
                                     'faculty', array_to_string(r.facs, ', '),
                                     'to', to_jsonb(r.emails),
                                     'emails', array_to_string(r.emails, ', '));
  end loop;

  if u !~ '^https://script\.google\.com/' then
    note := ' — not sent: email link not set up yet';
  else
    begin
      select net.http_post(
        url     := u,
        body    := jsonb_build_object('kind', 'reminder_batch', 'to', jsonb_build_array(public.setting('admin_email')),
                     'month', m_label, 'count', n, 'list', lst,
                     'secret', public.setting('mail_secret'), 'adminEmail', public.setting('admin_email'),
                     'siteUrl', public.setting('site_url')),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 300000
      ) into rid;
    exception when others then
      note := ' — error: ' || sqlerrm;
    end;
  end if;

  -- one log line per department, plus the summary
  insert into public.email_log (kind, recipients, summary, request_id)
  select 'reminder',
         coalesce(array(select jsonb_array_elements_text(x -> 'to')), '{}'),
         'Reminder · ' || (x ->> 'dept') || ' (' || (x ->> 'type') || ') · no report in ' || m_label || note,
         rid
    from jsonb_array_elements(lst) as x;
  insert into public.email_log (kind, recipients, summary, request_id)
  values ('reminder_summary', array[public.setting('admin_email')],
          'Reminder summary · ' || n || ' department(s) · ' || m_label || note, rid);
  return n;
end;
$$;

-- 10:00 AM IST (04:30 UTC) on the 20th of every month
do $$ begin perform cron.unschedule('iic-monthly-reminders'); exception when others then null; end $$;
select cron.schedule('iic-monthly-reminders', '30 4 20 * *', 'select public.send_monthly_reminders(false)');

-- ---------------------------------------------------------------------
-- Functions the tracker's Emails tab uses (coordinators only)
-- ---------------------------------------------------------------------
create or replace function public.admin_mail_settings()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  return jsonb_build_object(
    'webhook_url', public.setting('mail_webhook_url'),
    'secret', public.setting('mail_secret'),
    'admin_email', public.setting('admin_email'),
    'site_url', public.setting('site_url'),
    'reminders_enabled', coalesce(public.setting('reminders_enabled'), 'true') = 'true');
end;
$$;

create or replace function public.admin_save_mail_settings(p_url text, p_admin_email text, p_site_url text, p_reminders boolean)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  if coalesce(p_url, '') <> '' and p_url !~ '^https://script\.google\.com/macros/s/.+/exec$' then
    raise exception 'The Apps Script link should look like https://script.google.com/macros/s/…/exec';
  end if;
  if p_admin_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid coordinator email.';
  end if;
  insert into public.app_settings (key, value) values
    ('mail_webhook_url', coalesce(trim(p_url), '')),
    ('admin_email', lower(trim(p_admin_email))),
    ('site_url', coalesce(trim(p_site_url), '')),
    ('reminders_enabled', case when p_reminders then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value;
end;
$$;

create or replace function public.admin_send_test_email()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  perform public.queue_mail('test', array[public.setting('admin_email')], 'Test email', null, '{}'::jsonb);
end;
$$;

create or replace function public.admin_send_reminders_now()
returns integer language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  return public.send_monthly_reminders(true);
end;
$$;

create or replace function public.admin_email_log(p_limit integer default 100)
returns table (id bigint, kind text, recipients text[], summary text, created_at timestamptz,
               status_code integer, error_msg text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed.'; end if;
  return query
    select l.id, l.kind, l.recipients, l.summary, l.created_at, r.status_code, r.error_msg
      from public.email_log l
      left join net._http_response r on r.id = l.request_id
     order by l.id desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- ---------------------------------------------------------------------
-- Lock down: internal functions can't be called from the website
-- ---------------------------------------------------------------------
revoke execute on function public.setting(text)                                  from public, anon, authenticated;
revoke execute on function public.queue_mail(text, text[], text, uuid, jsonb)    from public, anon, authenticated;
revoke execute on function public.faculty_emails(text, text, text)               from public, anon, authenticated;
revoke execute on function public.report_recipients(text, text, text, text)      from public, anon, authenticated;
revoke execute on function public.reports_notify()                               from public, anon, authenticated;
revoke execute on function public.queries_notify()                               from public, anon, authenticated;
revoke execute on function public.send_monthly_reminders(boolean)                from public, anon, authenticated;

revoke execute on function public.admin_mail_settings()                          from public, anon;
revoke execute on function public.admin_save_mail_settings(text, text, text, boolean) from public, anon;
revoke execute on function public.admin_send_test_email()                        from public, anon;
revoke execute on function public.admin_send_reminders_now()                     from public, anon;
revoke execute on function public.admin_email_log(integer)                       from public, anon;
grant  execute on function public.admin_mail_settings()                          to authenticated;
grant  execute on function public.admin_save_mail_settings(text, text, text, boolean) to authenticated;
grant  execute on function public.admin_send_test_email()                        to authenticated;
grant  execute on function public.admin_send_reminders_now()                     to authenticated;
grant  execute on function public.admin_email_log(integer)                       to authenticated;
