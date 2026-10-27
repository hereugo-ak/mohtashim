# Make Room for Every Voice — AMU Campaign

## Start here

For the exact GitHub → Supabase → Render → Vercel setup sequence, read [`DEPLOY_FROM_ZERO.md`](./DEPLOY_FROM_ZERO.md). The copy/paste-ready database SQL is [`AMU_Campaign_Supabase_Schema.sql`](./AMU_Campaign_Supabase_Schema.sql), also preserved as a versioned migration under `supabase/migrations/`.

Anonymous contributions are supported by design: when a student selects “Keep my identity private,” both `student_name` and `class_name` are stored as SQL `NULL`. The backend enforces this before the insert and the database has a constraint that rejects any anonymous row containing either identity value.

This repository contains the approved mobile-first campaign frontend and its contribution API. The visual system—AMU green, ivory and gold; the candidate portrait; the faculty voice index; the contribution window; success screen; and six share-card variants—is preserved. The success receipt now repeats the exact faculty and topic selected and shows the full written idea. Share-card PNGs include the selected topic and a typographically styled excerpt of the idea; longer notes are shortened only on the card, while the complete note remains visible in the receipt. Name and class never appear on the share card.

## Deployment architecture

- **Vercel:** static frontend (Vite build output in `dist/`).
- **Render:** Node HTTP API (`backend/server.js`) for contribution submissions.
- **Supabase:** PostgreSQL storage, server-side validation, privacy enforcement and persistent rate limiting.

The Vercel `/api` handlers use the same validation/RPC implementation as the Render service and can support same-origin deployments, but the intended production route is Vercel frontend → Render API → Supabase.

## Local setup

Requires Node.js 20.19+; Node 22 is recommended.

1. Copy `.env.example` to `.env.local`.
2. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RATE_LIMIT_SECRET`, and local `FRONTEND_ORIGINS` values in `.env.local`.
3. Leave `VITE_API_BASE_URL=http://localhost:10000` for local API calls.
4. Start the API: `npm run start:backend`.
5. In a second terminal, start Vite: `npm run dev`.

The local API uses Node's built-in HTTP server and has no extra backend package dependencies. Never add a Supabase secret key to a `VITE_` variable.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/202610270001_student_contributions.sql`.
3. Prefer the current `sb_secret_...` key from **Settings → API Keys**. The API accepts a legacy `SUPABASE_SERVICE_ROLE_KEY` only as a migration fallback.
4. Run `supabase/tests/rls.test.sql` with the Supabase CLI/pgTAP test workflow if available.

The `student_contributions` table has RLS enabled and direct table grants revoked for public roles, including `service_role`. Only the server-executed `submit_student_contribution` RPC may write data. Public clients cannot read submissions. Campaign administrators can review the table in the Supabase Dashboard using their authorised account.

## Render API deployment

Create a Render **Web Service** from this repository:

- Root directory: repository root
- Build command: `npm install`
- Start command: `npm run start:backend`
- Health check: `/api/health`

Configure these environment variables on Render:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key (`sb_secret_...`) |
| `RATE_LIMIT_SECRET` | Random 32-byte-or-more secret for HMAC-based rate-limit keys |
| `FRONTEND_ORIGINS` | Comma-separated exact Vercel production and custom-domain origins |

Generate `RATE_LIMIT_SECRET` with `openssl rand -hex 32`. Keep Render and Vercel on HTTPS. Do not add the secret key to Vercel's frontend environment or to source control.

## Vercel frontend deployment

Set `VITE_API_BASE_URL` in Vercel for the **Production** environment to the Render service origin, for example `https://your-api.onrender.com`. Use the origin only—no `/api` suffix. Vite then calls `https://your-api.onrender.com/api/contributions`.

Set `FRONTEND_ORIGINS` on Render to the exact origin shown in Vercel, such as `https://your-app.vercel.app`, plus any custom domain. Add preview origins only if you intend preview deployments to submit to the same database; using a separate staging Supabase project for previews is safer. Redeploy Vercel after changing build-time `VITE_` variables.

After deploying both services, open `https://your-api.onrender.com/api/health`. It should return `ok: true` and `database: "connected"`. Then send a test contribution and verify it appears in `public.student_contributions` in Supabase. Do not distribute the public QR code until this end-to-end check passes.

## API contract

### `POST /api/contributions`

Accepts JSON with `faculty` (`agriculture`, `community`, or `theology`), `topic`, optional `details` (maximum 700 characters), `anonymous`, and `studentName`/`className` only when not anonymous. The browser's honeypot field is ignored for ordinary submissions. Server-side validation canonicalises fields, rejects invalid categories, enforces a body-size cap, checks allowed origins, and applies a database-backed limit of 15 valid submissions per 15 minutes and 80 per 24 hours per rate key.

Successful responses return a database UUID and short reference. Errors return safe user-facing messages and never echo stored contribution text. Anonymous submissions are stripped of name and class again on the server and SQL function before insert. No names, class values, descriptions, or raw IP addresses are written to logs. Only a keyed HMAC of the client IP is used for rate limiting, with old rate-limit entries removed after 72 hours.

### `GET /api/health`

Checks the backend configuration and calls the private Supabase health RPC. It exposes no credentials or contribution data.

## Security and privacy boundary

There is intentionally no public list/read endpoint, admin export URL, or authentication bypass. Use the Supabase Dashboard for authorised review; build a separately authenticated admin workflow before adding exports or moderation tools. Define a campaign data-retention policy and access list before launch. The current database stores non-anonymous name/class data to support the form's stated identity choice; anonymous submissions store both as `NULL`. Contribution descriptions should not contain sensitive information or identifying details about third parties.

CORS and the hidden honeypot are abuse-reduction measures, not a substitute for a managed challenge system. If the form receives spam, add Cloudflare Turnstile verification before promoting the QR code broadly.

## Project layout

```text
index.html
src/styles.css
src/main.js
src/data/faculties.js
src/lib/shareCards.js
src/lib/contributionRepository.js
src/lib/motion.js
api/contributions.js          Vercel-compatible API adapter
api/health.js
backend/server.js             Render HTTP server
backend/serverRoutes.js
server/contributionValidation.js
server/supabaseRest.js
supabase/migrations/202610270001_student_contributions.sql
supabase/tests/rls.test.sql
tests/backend.test.js
tests/share-cards.test.js
```

## Checks

```bash
npm run check
npm test
npm run build
```

The syntax checks and automated tests run without external services. A real database-backed submission, production Vite build and live health check require installing dependencies and configuring a Supabase project and Render/Vercel environments; they have not been performed in this workspace.
