# Render API service

This is the server process for the AMU campaign. The frontend remains on Vercel; Render receives contribution submissions and uses Supabase for persistence.

## Render service configuration

Create a **Web Service** from the same repository with:

- Root directory: repository root
- Runtime: Node
- Build command: `npm install`
- Start command: `npm run start:backend`
- Health-check path: `/api/health`

Set these environment variables in Render:

- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SECRET_KEY`: a current `sb_secret_...` key from Supabase Settings → API Keys. Prefer this over the legacy service-role key.
- `RATE_LIMIT_SECRET`: generate a random value with `openssl rand -hex 32`
- `FRONTEND_ORIGINS`: comma-separated exact origins, e.g. `https://your-campaign.vercel.app,https://your-custom-domain.example`

Do not use a `VITE_` prefix for server secrets. Do not commit `.env` files. Keep the Render service and Vercel frontend on HTTPS in production.

## Local full-stack development

Terminal 1 (Render-compatible API):

```bash
npm run start:backend
```

Terminal 2 (Vite frontend):

```bash
npm run dev
```

Copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL=http://localhost:10000`, and fill the server-side Supabase settings. Vite exposes only variables prefixed with `VITE_`; the secret variables stay server-side. Never prefix a Supabase secret with `VITE_`.

## API

- `GET /api/health`: checks whether the Supabase RPC migration is installed and reachable.
- `POST /api/contributions`: validates a contribution, applies origin checks and persistent rate limiting, then calls the private Supabase RPC.

Cross-origin calls are only allowed from origins listed in `FRONTEND_ORIGINS`. No endpoint lists or reads submissions publicly; authorised campaign administrators review records in the Supabase Dashboard.

The API has no external runtime package dependencies; it uses Node's built-in HTTP server and `fetch`. Run `npm test` and `npm run check` from the repository root before deploying.
