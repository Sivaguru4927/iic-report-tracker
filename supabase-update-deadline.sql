-- =====================================================================
-- UPDATE: submission deadline — a month's report is accepted during that month and until the
-- 10th of the next month (India time). Later submissions are refused. Queries are not affected.
-- Run in Supabase -> SQL Editor -> New query -> paste ALL -> Run. Safe to run again.
-- =====================================================================

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

notify pgrst, 'reload schema';
select 'Submission deadline installed' as result;
