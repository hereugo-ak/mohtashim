-- ============================================================================
-- Tier 1 keep-alive: Supabase pg_cron + pg_net pings the Render API
-- ============================================================================
-- Render's free tier stops an instance after 15 minutes with no inbound
-- requests, and a cold start takes roughly 30-60 seconds. This job pings the
-- public health endpoint every 10 minutes, with 1-15 seconds of random jitter
-- so the ping pattern is not perfectly periodic.
--
-- The health endpoint calls the `contribution_backend_health` RPC through the
-- Supabase REST API, so each ping also counts as project activity on the
-- Supabase side (helps avoid the free-plan 7-day inactivity pause).
--
-- Run this file once in the Supabase SQL Editor. It contains no secrets: the
-- Render URL is public by design. Safe to re-run; it replaces the old job.
-- ============================================================================

-- 1. Extensions. Guarded so a partially supported environment fails softly.
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

-- 2. Replace any previous keep-alive job, then schedule the current one.
select cron.unschedule('render-keep-alive')
where exists (select 1 from cron.job where jobname = 'render-keep-alive');

select cron.schedule(
  'render-keep-alive',
  '*/10 * * * *',
  $job$
  begin
    -- Random 1-15 s jitter before each ping.
    perform pg_sleep(1 + (random() * 14));
    perform net.http_get(
      url := 'https://mohtashim.onrender.com/api/health',
      timeout_milliseconds := 15000
    );
  end;
  $job$
);

-- 3. Verify the schedule is registered.
select jobname, schedule, active from cron.job where jobname = 'render-keep-alive';
