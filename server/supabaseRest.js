/**
 * Minimal server-only Supabase REST/RPC client. It avoids shipping a privileged
 * key to the browser and keeps this API dependency-free.
 *
 * Prefer the current `sb_secret_...` key. A legacy service-role JWT is accepted
 * during migration; it requires a Bearer header, while an opaque secret key must
 * be sent only in `apikey` (it is not a JWT).
 */
function validSupabaseUrl(value, env = process.env) {
  try {
    const parsed = new URL(value);
    const isHttps = parsed.protocol === 'https:';
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    return (isHttps || (env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && isLocal))
      && (isLocal || parsed.hostname.endsWith('.supabase.co'))
      && parsed.pathname === '/' && !parsed.search && !parsed.hash
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function getSupabaseConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const secretKey = String(env.SUPABASE_SECRET_KEY || '').trim();
  const legacyServiceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const apiKey = secretKey || legacyServiceRoleKey;
  const rateLimitSecret = String(env.RATE_LIMIT_SECRET || '');

  return {
    url,
    apiKey,
    isLegacyJwt: !secretKey && Boolean(legacyServiceRoleKey),
    rateLimitSecret,
    configured: Boolean(
      validSupabaseUrl(url, env) &&
      apiKey &&
      rateLimitSecret.length >= 32
    ),
  };
}

export async function callSupabaseRpc(functionName, args, options = {}) {
  const config = options.config || getSupabaseConfig();
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!config.configured) {
    return { ok: false, status: 503, data: null, code: 'backend_not_configured' };
  }

  const headers = {
    apikey: config.apiKey,
    'content-type': 'application/json',
    accept: 'application/json',
  };
  if (config.isLegacyJwt) headers.authorization = `Bearer ${config.apiKey}`;

  let response;
  try {
    response = await fetchImpl(`${config.url}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, status: 503, data: null, code: 'database_unavailable' };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    code: response.ok ? null : 'database_error',
  };
}
