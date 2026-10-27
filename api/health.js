import { callSupabaseRpc, getSupabaseConfig } from '../server/supabaseRest.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const config = getSupabaseConfig();
  if (!config.configured) {
    return res.status(503).json({ ok: false, service: 'contribution-api', database: 'not_configured' });
  }

  const result = await callSupabaseRpc('contribution_backend_health', {}, { config });
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!result.ok || !data?.ok) {
    return res.status(503).json({ ok: false, service: 'contribution-api', database: 'not_ready' });
  }

  return res.status(200).json({
    ok: true,
    service: 'contribution-api',
    database: 'connected',
    schemaVersion: data.schema_version,
  });
}
