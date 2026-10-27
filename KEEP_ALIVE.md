# Keep the Render API awake 24/7

Render's free tier stops a web service after **15 minutes with no inbound
requests**. Restarting it takes roughly **30–60 seconds**, during which
submissions time out. This project therefore runs a **three-tier keep-alive
system** so the API is warm whenever a visitor arrives. No tier trusts another
tier to always work; each covers the others' failure modes.

```
Tier 1  Supabase pg_cron + pg_net    ── every 10 min (jittered 1–15 s) ──┐
Tier 2  GitHub Actions cron          ── :07 :17 :27 :37 :47 :57         ──┼──▶  Render
Tier 3  Browser warm-up + smart retry ── page load + every 4 min (visible)─┘     /api/health
                                                                              /api/contributions
```

Pings are spaced so that if any single tier dies, the remaining gap stays at
or near the 15-minute spin-down threshold — and the submit path itself can
wake the service on demand.

## Tier 1 — Supabase pg_cron + pg_net (primary)

A database-level scheduler inside Supabase calls the public health endpoint
every 10 minutes with 1–15 seconds of random jitter. It is precise, never
drifts, and cannot be "auto-disabled" by a third party.

1. Open the Supabase project → **SQL Editor**.
2. Paste the entire contents of `supabase/keep_alive_cron.sql` and run it once.
3. Confirm it returns the scheduled job row (`render-keep-alive`, active).

Verify it is firing:

```sql
select jobname, schedule, active from cron.job
where jobname = 'render-keep-alive';

select status, start_time, end_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'render-keep-alive')
order by start_time desc limit 10;
```

Each ping's HTTP result is also visible with:

```sql
select status_code, content, created
from net._http_response
order by id desc limit 10;
```

Side benefit: the health endpoint calls the `contribution_backend_health`
RPC through the Supabase REST API, so these pings count as project activity
and reduce the chance of the free-plan 7-day inactivity pause.

To remove the job: `select cron.unschedule('render-keep-alive');`

## Tier 2 — GitHub Actions pinger (backup)

`.github/workflows/keep-render-alive.yml` runs on a public-repo-friendly
schedule (offset minutes `7,17,…`) so its pings interleave between the Tier 1
pings instead of stacking on the same minute. Each run attempts up to three
health checks, which is enough to ride out a cold start if it ever has to
revive the service alone. Failures emit a warning annotation instead of
failing the run, so there is no red-X alert fatigue.

- Works out of the box; public repos get free, unlimited Actions minutes.
- Optional override: set the repository variable `RENDER_HEALTH_URL`
  (Settings → Secrets and variables → Actions → Variables) if the Render
  origin ever changes.
- Trigger a manual run from the Actions tab with **Run workflow**.

## Tier 2b — Repository heartbeat (keeps Tier 2 alive)

GitHub **auto-disables scheduled workflows after 60 days without repository
activity**. `.github/workflows/repo-heartbeat.yml` commits a one-line
`keep-alive.stamp` file every Monday, resetting that clock so the pinger is
never silently switched off. It uses a `[skip ci]` message and no-ops if the
stamp is somehow unchanged.

## Tier 3 — Browser warm-up and duplicate-safe retry

Built into the frontend; needs no setup.

- `src/main.js` pings `/api/health` on page load and every 4 minutes while
  the tab is visible, and again on tab re-focus. A visitor reading the page
  keeps the service warm right up to the moment they submit.
- `src/lib/contributionRepository.js` makes the submit path resilient:
  - Attempt 1 uses a 12 s timeout.
  - On a clean connection failure (service asleep) it wakes the service by
    polling health for up to ~66 s, then retries the submission once with a
    30 s timeout.
  - On an ambiguous **timeout** (request may have reached the server) it warms
    the service but does **not** auto-resubmit — this prevents duplicate
    contributions. The visitor simply taps submit again, hitting a warm API.

## Instance-hours budget (important)

Render's free tier allows **750 instance-hours per month**. One service
running 24/7 uses about **744 hours**, so this setup fits — barely. It only
stays free if **no other free service** runs in the same Render workspace;
each extra always-on service pushes the account into paid usage. If more
services are needed later, put this API on the paid Starter plan ($25 range)
and keep everything else free.

## Monitoring checklist

- **Render dashboard → service → Metrics**: the "Requests" graph should show
  a steady ~1 request per few minutes, never flat for 15+ minutes.
- **GitHub repo → Actions**: `Keep Render API warm` should show runs every
  ~10 minutes; `Repository heartbeat` one green run per week.
- **Supabase SQL editor**: the `cron.job_run_details` query above shows
  recent successful schedules.
- After any change to the Render service URL, update it in three places:
  Vercel's `VITE_API_BASE_URL`, `supabase/keep_alive_cron.sql`, and the
  `RENDER_HEALTH_URL` repository variable (or the default in the workflow).
