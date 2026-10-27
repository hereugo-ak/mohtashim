# Deploy the AMU campaign from zero

This project is deployed as one GitHub repository with two hosts and one database:

- **GitHub** stores the source code.
- **Vercel** serves the public frontend.
- **Render** hosts the Node.js contribution API.
- **Supabase** stores contributions in PostgreSQL.

The frontend does not connect to Supabase directly. The Supabase secret key belongs only in Render's environment settings.

## 1. Put the project in GitHub

1. Download and extract `amu-campaign-frontend.zip` (or use the folder you already have).
2. Keep the existing folder structure. At the repository root, `package.json`, `index.html`, `src/`, `api/`, `backend/`, `server/`, `supabase/`, `public/`, `render.yaml`, and `vercel.json` should sit beside one another. Do not create an extra nested copy of the project folder inside the repo.
3. Create a GitHub repository. A private repository is sensible for campaign source, but it does not replace secret management.
4. From a terminal opened at the project root, run:

```bash
git init
git add .
git commit -m "Build AMU campaign frontend and contribution backend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your actual repository URL. If Git was already initialized, do not run `git init` again; just add, commit, and push the changed files.

**Never commit `.env.local`, `.env`, or any real secret key.** `.gitignore` excludes these files. `.env.example` contains placeholders only.

## 2. Create Supabase and apply the schema

1. Create a new project at https://supabase.com/dashboard. Save the database password securely.
2. In the project's SQL Editor, create a new query.
3. Open `AMU_Campaign_Supabase_Schema.sql` in this repository, copy the entire file into the SQL Editor, and run it once. It creates `public.student_contributions`, a private rate-limit table, the restricted submission RPC, the health RPC, checks, and permissions.
4. Confirm the schema ran successfully. In SQL Editor, you can test the function as the database owner with:

```sql
select public.contribution_backend_health();
```

It should return JSON containing `"ok": true` and schema version `1`.
5. In Supabase **Settings → API Keys**, copy the project URL and create/copy a current **secret key** whose value starts with `sb_secret_`. Use the secret key for backend-to-Supabase requests only. Do not paste it into `index.html`, any `VITE_` variable, frontend code, GitHub, or this chat.

The table enables RLS and revokes direct table permissions from public roles. Public visitors cannot read submissions. The intended review path for the first launch is the authorized Supabase Dashboard; there is deliberately no public contribution-list endpoint.

## 3. Deploy the API on Render

1. Open https://dashboard.render.com and create a **New → Blueprint** using the GitHub repository if you want Render to read `render.yaml`; alternatively create a **New → Web Service** connected to the same repo.
2. For a manual Web Service, use these settings:
   - Root directory: repository root (leave blank)
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm run start:backend`
   - Health check path: `/api/health`
3. Add environment variables on Render:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Supabase, e.g. `https://YOUR-REF.supabase.co` |
| `SUPABASE_SECRET_KEY` | The `sb_secret_...` key from Supabase Settings → API Keys |
| `RATE_LIMIT_SECRET` | Random 32-byte-or-more secret; `openssl rand -hex 32` works in a shell that has OpenSSL |
| `FRONTEND_ORIGINS` | Exact Vercel site origin, e.g. `https://your-project.vercel.app` (no trailing slash) |

If you create the Render service before Vercel, set a temporary placeholder for `FRONTEND_ORIGINS`, then replace it with the exact Vercel production origin after Vercel deploys. You may include an additional exact custom domain separated by a comma. Do not allow arbitrary origins.

4. Deploy and note the service origin, e.g. `https://amu-campaign-api.onrender.com`.
5. Open `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. Once the environment variables and Supabase schema are correct, it should return `ok: true` and `database: "connected"`. If it returns `not_configured` or `not_ready`, review Render logs and the variable names, not the secret values.

## 4. Deploy the frontend on Vercel

1. Open https://vercel.com/dashboard and import the same GitHub repository.
2. Framework preset: **Vite**; install command `npm install`; build command `npm run build`; output directory `dist`.
3. Add this environment variable in the Vercel project's **Production** environment:

```text
VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

Use only the Render origin; do not append `/api` and do not add a trailing slash. This value is public by design. It is not a key or password.
4. Deploy or redeploy Vercel after adding/changing the variable; Vite embeds `VITE_` variables during the build.
5. Copy the final Vercel origin (for example `https://your-project.vercel.app`) into Render's `FRONTEND_ORIGINS`, with no trailing slash, and redeploy/restart the Render service if necessary.

The request flow is: **visitor → Vercel frontend → Render `/api/contributions` → Supabase RPC → PostgreSQL**.

## 5. Test both identity modes before sharing the QR

Use the live Vercel site and submit one test of each kind.

- **Identity private:** tick “Keep my identity private”, submit a contribution, and confirm success. In `public.student_contributions`, the new row must have `is_anonymous = true`, `student_name IS NULL`, and `class_name IS NULL`.
- **Named submission:** untick the private option, provide the required name and class/course, submit, and confirm the name and class are present.
- **Failure state:** if the API is unavailable, the UI must show an error and must not claim the contribution was received.
- **No public reads:** never create a public `SELECT` policy or public listing endpoint for student contributions.

SQL to check the privacy mode after your test submissions:

```sql
select id, created_at, faculty, topic, is_anonymous,
       (student_name is null) as name_is_null,
       (class_name is null) as class_is_null
from public.student_contributions
order by created_at desc
limit 20;
```

Review records only while signed in with an authorized Supabase administrator account. Do not publish this query or expose it through the frontend.

## 6. Run local checks

Node.js 22 is recommended. In the repository root:

```bash
npm install
npm run check
npm test
npm run build
```

For local frontend plus Render-compatible API, copy `.env.example` to `.env.local`, fill the server-side Supabase values, and keep `VITE_API_BASE_URL=http://localhost:10000`. In terminal 1 run `npm run start:backend`; in terminal 2 run `npm run dev`.

## Anonymous identity behavior

The anonymity preference is enforced in three places:

1. The browser sends `anonymous: true` and blank/null name and class fields.
2. The server independently forces `studentName = null` and `className = null` whenever `anonymous` is true, even if a modified client sends values.
3. The SQL submission function applies the same rule immediately before insert. The table constraint requires both identity columns to be NULL for an anonymous record, or both to be present for a named record.

Therefore the database accepts anonymous contributions intentionally. Faculty, topic, description and timestamp are still stored to make the contribution useful. Students are warned not to put identifying details in the optional description; the system cannot reliably detect or remove names typed into free text.

## Operational notes

- The Render free tier spins down after 15 idle minutes. The multi-tier keep-alive system (Supabase pg_cron, GitHub Actions, browser warm-up) keeps the API warm; see `KEEP_ALIVE.md` for setup and verification.
- There is no admin dashboard or public read endpoint in this version. Review responses from the Supabase Dashboard only.
- Choose who may access the Supabase project and define a retention/deletion policy before launch.
- The honeypot and IP-derived HMAC rate limiter reduce basic abuse but are not a perfect bot defense. If spam becomes material, add a managed challenge such as Turnstile.
- This guide is not proof of a live deployment. Verify the health endpoint and test both identity modes in the actual deployed stack before distributing the public QR code.
