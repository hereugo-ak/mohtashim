-- Make Room for Every Voice — private contribution backend.
-- Run this migration in the intended Supabase project before enabling the API.

begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create table if not exists public.student_contributions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  faculty text not null check (faculty in ('agriculture', 'community', 'theology')),
  topic text not null check (topic in (
    'Teaching & curriculum',
    'Facilities & infrastructure',
    'Practical learning & research',
    'Student welfare & wellbeing',
    'Administration & communication',
    'Safety & accessibility',
    'Something else'
  )),
  student_name text,
  class_name text,
  is_anonymous boolean not null default false,
  details text,
  constraint contribution_name_length check (student_name is null or char_length(student_name) between 2 and 100),
  constraint contribution_class_length check (class_name is null or char_length(class_name) between 2 and 100),
  constraint contribution_details_length check (details is null or char_length(details) <= 700),
  constraint contribution_identity_consistency check (
    (is_anonymous and student_name is null and class_name is null)
    or
    (not is_anonymous and student_name is not null and class_name is not null)
  )
);

comment on table public.student_contributions is
  'Student ideas and concerns for the AMU University Court candidate campaign. Restricted to server-mediated writes; no public read access.';
comment on column public.student_contributions.is_anonymous is
  'When true, student_name and class_name are null and not stored.';

alter table public.student_contributions enable row level security;
revoke all on table public.student_contributions from public, anon, authenticated, service_role;

create table if not exists app_private.contribution_rate_limits (
  rate_key text primary key check (rate_key ~ '^[0-9a-f]{64}$'),
  short_window_started_at timestamptz not null,
  short_count integer not null default 0,
  day_window_started_at timestamptz not null,
  day_count integer not null default 0,
  last_seen_at timestamptz not null default now()
);
create index if not exists contribution_rate_limits_last_seen_idx
  on app_private.contribution_rate_limits (last_seen_at);
revoke all on table app_private.contribution_rate_limits from public, anon, authenticated, service_role;

create or replace function public.submit_student_contribution(
  p_rate_key text,
  p_faculty text,
  p_topic text,
  p_details text,
  p_student_name text,
  p_class_name text,
  p_is_anonymous boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_short_count integer;
  v_day_count integer;
  v_name text;
  v_class text;
  v_details text;
  v_id uuid;
  v_created_at timestamptz;
begin
  if p_rate_key is null or p_rate_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate key' using errcode = '22023';
  end if;

  if p_faculty is null or p_faculty not in ('agriculture', 'community', 'theology') then
    raise exception 'invalid faculty' using errcode = '22023';
  end if;

  if p_topic is null or p_topic not in (
    'Teaching & curriculum',
    'Facilities & infrastructure',
    'Practical learning & research',
    'Student welfare & wellbeing',
    'Administration & communication',
    'Safety & accessibility',
    'Something else'
  ) then
    raise exception 'invalid topic' using errcode = '22023';
  end if;

  if p_is_anonymous is null then
    raise exception 'identity preference is required' using errcode = '22023';
  end if;

  v_details := nullif(pg_catalog.btrim(p_details), '');
  if v_details is not null and pg_catalog.char_length(v_details) > 700 then
    raise exception 'details too long' using errcode = '22023';
  end if;

  if p_is_anonymous then
    -- The anonymous choice must remove identity fields, not just hide them in the UI.
    v_name := null;
    v_class := null;
  else
    v_name := nullif(pg_catalog.btrim(p_student_name), '');
    v_class := nullif(pg_catalog.btrim(p_class_name), '');
    if v_name is null or pg_catalog.char_length(v_name) not between 2 and 100 then
      raise exception 'invalid name' using errcode = '22023';
    end if;
    if v_class is null or pg_catalog.char_length(v_class) not between 2 and 100 then
      raise exception 'invalid class' using errcode = '22023';
    end if;
  end if;

  -- Keep only a keyed hash of the IP-derived rate key and purge old hashes.
  delete from app_private.contribution_rate_limits
    where last_seen_at < v_now - interval '72 hours';

  insert into app_private.contribution_rate_limits (
    rate_key, short_window_started_at, short_count,
    day_window_started_at, day_count, last_seen_at
  ) values (p_rate_key, v_now, 1, v_now, 1, v_now)
  on conflict (rate_key) do update set
    short_count = case
      when app_private.contribution_rate_limits.short_window_started_at <= v_now - interval '15 minutes' then 1
      else least(app_private.contribution_rate_limits.short_count + 1, 16)
    end,
    short_window_started_at = case
      when app_private.contribution_rate_limits.short_window_started_at <= v_now - interval '15 minutes' then v_now
      else app_private.contribution_rate_limits.short_window_started_at
    end,
    day_count = case
      when app_private.contribution_rate_limits.day_window_started_at <= v_now - interval '24 hours' then 1
      else least(app_private.contribution_rate_limits.day_count + 1, 81)
    end,
    day_window_started_at = case
      when app_private.contribution_rate_limits.day_window_started_at <= v_now - interval '24 hours' then v_now
      else app_private.contribution_rate_limits.day_window_started_at
    end,
    last_seen_at = v_now
  returning short_count, day_count into v_short_count, v_day_count;

  if v_short_count > 15 or v_day_count > 80 then
    return pg_catalog.jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  insert into public.student_contributions (
    faculty, topic, details, student_name, class_name, is_anonymous
  ) values (
    p_faculty, p_topic, v_details, v_name, v_class, p_is_anonymous
  )
  returning id, created_at into v_id, v_created_at;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'id', v_id,
    'created_at', v_created_at
  );
end;
$function$;

revoke all on function public.submit_student_contribution(text, text, text, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.submit_student_contribution(text, text, text, text, text, text, boolean)
  to service_role;

create or replace function public.contribution_backend_health()
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $function$
  select pg_catalog.jsonb_build_object('ok', true, 'schema_version', 1);
$function$;
revoke all on function public.contribution_backend_health() from public, anon, authenticated, service_role;
grant execute on function public.contribution_backend_health() to service_role;

commit;
