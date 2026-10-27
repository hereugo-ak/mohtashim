# Keep the campaign API always available

This project's request path is now **visitor → same-origin Vercel serverless
function → Supabase**. Serverless functions do not hibernate like Render's
free containers: there is no 15-minute spin-down, and a cold start is a
fraction of a second instead of 30–60 seconds. The "keep the server awake"
problem is removed by architecture, not by pingers.

The Render web service can remain deployed as a standby, but nothing in the
frontend depends on it anymore.

## Primary path — Vercel serverless API (one-time setup)

The functions ship in this repository (`api/contributions.js`,
`api/health.js`, `server/*`) and are already deployed on Vercel; they only
need the database credentials as Vercel environment variables.

1. In Vercel → project → **Settings → Environment Variables**, add for
   **Production** (and Preview):

   | Variable | Value | Type |
   |---|---|---|
   | `SUPABASE_URL` | `https://YOUR-REF.supabase.co` | Config |
   | `SUPABASE_SECRET_KEY` | The `sb_secret_...` key (copy from Render's env settings or Supabase → Settings → API Keys) | **Secret** |
   | `RATE_LIMIT_SECRET` | Any random string of 32+ characters | **Secret** |

   PowerShell one-liner to generate the rate-limit secret:
   ```powershell
   -join ((1..2) | ForEach-Object { [guid]::NewGuid().ToString('N') })
   ```

2. **Delete** `VITE_API_BASE_URL` from the Vercel project. With it removed,
   the frontend automatically submits to its own origin
   (`/api/contributions`) — no CORS, no Render dependency.

3. **Redeploy** (Deployments → latest → ⋯ → Redeploy). Vite and Vercel
   functions both read environment variables at build/deploy time.

4. Verify: open `https://mohtashimforcourtmember.vercel.app/api/health`.
   It must return `{"ok":true,"database":"connected"}`. Then submit one test
   contribution from the site and confirm it lands in Supabase.

The privileged key lives only in Vercel's encrypted server-side
environment — it is never included in the browser bundle and never sent to
the visitor.

## Uptime monitor — GitHub Actions

`.github/workflows/keep-render-alive.yml` checks the **real visitor path**
(the same-origin health endpoint) every 10 minutes and raises an `::error`
annotation on the repo if it ever fails. GitHub registers new cron schedules
with a delay (often 30–60 minutes after push) and runs can drift a few
minutes — that is fine, because the primary path does not depend on this
monitor. Optional repository variables: `VERCEL_HEALTH_URL`,
`RENDER_HEALTH_URL`.

`.github/workflows/repo-heartbeat.yml` commits a weekly stamp so GitHub's
60-day inactivity rule never disables the scheduled monitor.

## If you keep the Render service as a standby

Render's free tier still spins down after ~15 idle minutes, which is
acceptable for an unused standby. If you want Render kept warm anyway:

1. Run `supabase/keep_alive_cron.sql` once in the Supabase SQL Editor. It
   schedules an in-database `pg_cron` job (every 10 minutes, jittered) that
   pings `https://mohtashim.onrender.com/api/health`, and self-tests the ping
   immediately. Expect the self-test row to return `ping sent`.
2. Optionally add a free external monitor at cron-job.org or UptimeRobot
   (5-minute checks) pointing at the same URL — a third, independent pinger.
3. Instance-hours math: one always-on free service uses ~744 of the 750 free
   monthly hours. Keep only this one service on the free tier, or move it to
   the paid Starter plan.

To point the frontend back at Render instead, set
`VITE_API_BASE_URL=https://mohtashim.onrender.com` in Vercel and redeploy —
but the same-origin path above is the recommended, sleep-proof setup.

## Troubleshooting the Supabase pinger

- `cron.job_run_details` shows `failed`: re-run the SQL file (v2 fixes the
  plain-SQL/`perform` bug that failed every run in v1).
- The self-test returns `error: ...`: the message names the cause — most
  commonly pg_net not being available; enable it under Database → Extensions.
- `select * from net._http_response order by id desc limit 5;` shows recent
  HTTP results.
