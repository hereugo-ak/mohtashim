-- ============================================================================
-- Keep-alive pinger for the Render API (Supabase pg_cron + pg_net)
-- ============================================================================
-- Renders's free tier stops an instance after ~15 minutes without inbound
-- requests; a cold start takes 30-60 seconds. This schedules an in-database
-- job that calls the public health endpoint every 10 minutes with 1-15 s of
-- random jitter.
--
-- NOTE: the primary request path is now the same-origin Vercel function
-- (see KEEP_ALIVE.md). Render only needs this pinger if you keep it deployed
-- as a standby API or still point traffic at it.
--
-- v2 FIX: pg_cron runs its command as PLAIN SQL, so the previous version's
-- `perform pg_sleep(...)` (PL/pgSQL syntax) failed on every run. The job now
-- calls a proper stored function, and this file self-tests it before finishing.
--
-- Run this file ONCE in the Supabase SQL Editor. It contains no secrets: the
-- Render URL is public by design. Safe to re-run; it replaces the old job.
-- ============================================================================

-- 1. Extensions, guarded so a partially supported environment fails softly.
do $extension$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron could not be enabled: %', sqlerrm;
end $extension$;

do $extension$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net could not be enabled: %', sqlerrm;
end $extension$;

-- 2. The ping function. Returns a status string so it can be tested by hand.
create or replace function public.keep_render_warm()
returns text
language plpgsql
set search_path = extensions, public
as $function$
begin
  -- Random 1-15 s jitter so the ping pattern is not perfectly periodic.
  perform pg_sleep(1 + (random() * 14));
  begin
    perform net.http_get(
      url := 'https://mohtashim.onrender.com/api/health',
      timeout_milliseconds := 15000
    );
    return 'ping sent';
  exception when others then
    return 'error: ' || sqlerrm;
  end;
end;
$function$;

-- 3. Replace any previous job, then schedule the current one.
select cron.unschedule('render-keep-alive')
where exists (select 1 from cron.job where jobname = 'render-keep-alive');

select cron.schedule(
  'render-keep-alive',
  '*/10 * * * *',
  'select public.keep_render_warm();'
);

-- 4. Self-test: fires one ping right now (takes up to ~15 s because of jitter).
--    Expect a single row: "ping sent".
select public.keep_render_warm() as self_test;

-- 5. Confirm the schedule is registered.
select jobname, schedule, active from cron.job where jobname = 'render-keep-alive';

-- Later, to verify runs:
--   select status, start_time, end_time from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'render-keep-alive')
--   order by start_time desc limit 10;
--
-- To remove the job entirely:
--   select cron.unschedule('render-keep-alive');
--   drop function public.keep_render_warm();
