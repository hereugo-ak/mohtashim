import { createHmac } from 'node:crypto';
import { MAX_REQUEST_BYTES, isHoneypotFilled, validateContribution } from '../server/contributionValidation.js';
import { callSupabaseRpc, getSupabaseConfig } from '../server/supabaseRest.js';

function secureHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function json(res, status, body) {
  return res.status(status).json(body);
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return { value: req.body, byteLength: Buffer.byteLength(JSON.stringify(req.body)) };
  }
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString('utf8');
    return { value: JSON.parse(text), byteLength: Buffer.byteLength(text) };
  }
  if (typeof req.body === 'string') {
    return { value: JSON.parse(req.body), byteLength: Buffer.byteLength(req.body) };
  }
  return { value: null, byteLength: 0 };
}

function allowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true; // Non-browser clients still face validation, rate limits and database controls.
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.origin !== origin) return false;

  const configuredOrigins = String(process.env.FRONTEND_ORIGINS || '')
    .split(',').map((value) => value.trim().replace(/\/+$/, '')).filter(Boolean);
  if (configuredOrigins.includes(parsed.origin)) return true;

  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase();
  return Boolean(host && parsed.host.toLowerCase() === host);
}

function addCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin');
}

function clientIp(req) {
  // Vercel overwrites X-Forwarded-For to prevent client IP spoofing.
  const raw = req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for'];
  if (typeof raw !== 'string') return '';
  const first = raw.split(',')[0].trim();
  if (!first || first.length > 80 || /[^0-9a-f:.%]/i.test(first)) return '';
  return first.toLowerCase().replace(/^::ffff:/, '');
}

function rateLimitKey(ip, secret) {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

function safeDatabaseData(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data && typeof data === 'object' ? data : null;
}

export default async function handler(req, res) {
  secureHeaders(res);

  if (!allowedOrigin(req)) {
    return json(res, 403, { ok: false, error: { code: 'origin_not_allowed', message: 'This request could not be verified. Please use the campaign website.' } });
  }
  addCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.setHeader('Content-Length', '0');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: { code: 'method_not_allowed', message: 'Use POST to submit a contribution.' } });
  }

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return json(res, 415, { ok: false, error: { code: 'json_required', message: 'Please try again using the campaign form.' } });
  }

  const declaredLength = Number(req.headers?.['content-length'] || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return json(res, 413, { ok: false, error: { code: 'payload_too_large', message: 'Your contribution is too large. Shorten it and try again.' } });
  }

  let body;
  try {
    const parsed = requestBody(req);
    if (parsed.byteLength > MAX_REQUEST_BYTES) {
      return json(res, 413, { ok: false, error: { code: 'payload_too_large', message: 'Your contribution is too large. Shorten it and try again.' } });
    }
    body = parsed.value;
  } catch {
    return json(res, 400, { ok: false, error: { code: 'invalid_json', message: 'The form could not be read. Please try again.' } });
  }

  // Silently absorb obvious bots instead of teaching them which check failed.
  if (isHoneypotFilled(body)) {
    return json(res, 202, { ok: true, id: null, createdAt: new Date().toISOString(), accepted: true });
  }

  const validation = validateContribution(body);
  if (!validation.ok) return json(res, 400, validation);

  const config = getSupabaseConfig();
  if (!config.configured) {
    return json(res, 503, { ok: false, error: { code: 'backend_not_configured', message: 'The campaign inbox is not ready yet. Your contribution has not been submitted.' } });
  }

  const ip = clientIp(req);
  if (!ip) {
    return json(res, 503, { ok: false, error: { code: 'request_unverifiable', message: 'We could not verify this request. Please retry from the campaign website.' } });
  }

  const { faculty, topic, details, studentName, className, anonymous } = validation.value;
  const result = await callSupabaseRpc('submit_student_contribution', {
    p_rate_key: rateLimitKey(ip, config.rateLimitSecret),
    p_faculty: faculty,
    p_topic: topic,
    p_details: details,
    p_student_name: studentName,
    p_class_name: className,
    p_is_anonymous: anonymous,
  }, { config });

  if (!result.ok) {
    // Do not log request bodies, IP addresses, names, classes, or contribution text.
    console.error('[contributions] Supabase RPC failed', { status: result.status, code: result.code });
    return json(res, 503, { ok: false, error: { code: 'database_unavailable', message: 'The campaign inbox is temporarily unavailable. Your contribution has not been submitted. Please try again shortly.' } });
  }

  const saved = safeDatabaseData(result.data);
  if (saved?.code === 'rate_limited') {
    res.setHeader('Retry-After', '900');
    return json(res, 429, { ok: false, error: { code: 'rate_limited', message: 'Too many contributions came from this connection in a short time. Please wait a little and try again.' } });
  }
  if (!saved?.ok || typeof saved.id !== 'string' || typeof saved.created_at !== 'string') {
    console.error('[contributions] Supabase RPC returned an unexpected response');
    return json(res, 503, { ok: false, error: { code: 'database_not_ready', message: 'The campaign inbox is not ready yet. Your contribution has not been submitted.' } });
  }

  return json(res, 201, {
    ok: true,
    id: saved.id,
    createdAt: saved.created_at,
    reference: saved.id.slice(0, 8).toUpperCase(),
    status: 'received',
  });
}
