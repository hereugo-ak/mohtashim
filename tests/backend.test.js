import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/contributions.js';
import { validateContribution, isHoneypotFilled } from '../server/contributionValidation.js';
import { callSupabaseRpc, getSupabaseConfig } from '../server/supabaseRest.js';
import { createBackendServer } from '../backend/server.js';

const base = {
  faculty: 'agriculture',
  topic: 'Facilities & infrastructure',
  details: 'More reliable access to practical-learning spaces.',
  studentName: 'A Student',
  className: 'B.Sc. 2nd year',
  anonymous: false,
  website: '',
};

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end(body = '') { this.body = body; this.ended = true; return this; },
  };
}

function fakeRequest({ method = 'POST', body = base, headers = {} } = {}) {
  return {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      host: 'campaign.example',
      origin: 'https://campaign.example',
      'x-forwarded-for': '203.0.113.21',
      ...headers,
    },
  };
}

function setBackendEnv(t) {
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RATE_LIMIT_SECRET', 'NODE_ENV', 'FRONTEND_ORIGINS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.SUPABASE_URL = 'https://campaign-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_key';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.RATE_LIMIT_SECRET = 'x'.repeat(64);
  process.env.NODE_ENV = 'test';
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test('server canonicalizes valid contributions and drops identity fields when anonymous', () => {
  const result = validateContribution({ ...base, anonymous: true });
  assert.equal(result.ok, true);
  assert.equal(result.value.studentName, null);
  assert.equal(result.value.className, null);
  assert.equal(result.value.faculty, 'agriculture');
});

test('server rejects invalid faculty, topic, and overlong descriptions', () => {
  assert.equal(validateContribution({ ...base, faculty: 'made-up' }).ok, false);
  assert.equal(validateContribution({ ...base, topic: 'Make me president' }).ok, false);
  assert.equal(validateContribution({ ...base, details: 'x'.repeat(701) }).ok, false);
});

test('honeypot identifies automated submissions', () => {
  assert.equal(isHoneypotFilled({ website: 'bot-filled-this' }), true);
  assert.equal(isHoneypotFilled({ website: '' }), false);
});

test('backend config requires HTTPS Supabase URL, server key and a rate-limit secret', () => {
  assert.equal(getSupabaseConfig({ SUPABASE_URL: 'http://example.com', SUPABASE_SECRET_KEY: 'secret', RATE_LIMIT_SECRET: 'x'.repeat(64), NODE_ENV: 'production' }).configured, false);
  assert.equal(getSupabaseConfig({ SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_demo', RATE_LIMIT_SECRET: 'x'.repeat(64), NODE_ENV: 'production' }).configured, true);
});

test('new opaque Supabase secret keys are sent only in apikey header', async (t) => {
  const config = {
    url: 'https://demo.supabase.co', apiKey: 'sb_secret_demo', isLegacyJwt: false,
    rateLimitSecret: 'x'.repeat(64), configured: true,
  };
  const response = await callSupabaseRpc('health', {}, {
    config,
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.apikey, 'sb_secret_demo');
      assert.equal(options.headers.authorization, undefined);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(response.ok, true);
});

test('POST rejects cross-origin requests before touching Supabase', async (t) => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not call database'); };
  t.after(() => { globalThis.fetch = oldFetch; });
  const res = fakeResponse();
  await handler(fakeRequest({ headers: { origin: 'https://attacker.example' } }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'origin_not_allowed');
});

test('POST validates on server and does not call Supabase for invalid payloads', async (t) => {
  setBackendEnv(t);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not call database'); };
  t.after(() => { globalThis.fetch = oldFetch; });
  const res = fakeResponse();
  await handler(fakeRequest({ body: { ...base, faculty: 'random' } }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.field, 'faculty');
});

test('POST stores anonymous contributions without name or class and returns a receipt', async (t) => {
  setBackendEnv(t);
  const oldFetch = globalThis.fetch;
  let sentUrl = '';
  let sentOptions;
  globalThis.fetch = async (url, options) => {
    sentUrl = url;
    sentOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, id: '97fe9eab-0db4-4127-a381-bcd3929dcb66', created_at: '2026-10-27T12:00:00+00:00' }),
    };
  };
  t.after(() => { globalThis.fetch = oldFetch; });
  const res = fakeResponse();
  await handler(fakeRequest({ body: { ...base, anonymous: true, studentName: 'Must not be stored', className: 'Must not be stored' } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, 'received');
  assert.equal(res.body.reference, '97FE9EAB');
  assert.match(sentUrl, /\/rest\/v1\/rpc\/submit_student_contribution$/);
  assert.equal(sentOptions.headers.apikey, 'sb_secret_test_key');
  assert.equal(sentOptions.headers.authorization, undefined);
  const rpc = JSON.parse(sentOptions.body);
  assert.equal(rpc.p_student_name, null);
  assert.equal(rpc.p_class_name, null);
  assert.match(rpc.p_rate_key, /^[a-f0-9]{64}$/);
  assert.equal(rpc.p_rate_key.includes('203.0.113.21'), false);
});

test('rate-limited database response becomes HTTP 429', async (t) => {
  setBackendEnv(t);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, code: 'rate_limited' }) });
  t.after(() => { globalThis.fetch = oldFetch; });
  const res = fakeResponse();
  await handler(fakeRequest(), res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['retry-after'], '900');
});

 test('allowlisted frontend origins receive valid CORS preflight headers', async (t) => {
  setBackendEnv(t);
  process.env.FRONTEND_ORIGINS = 'https://campaign.vercel.app';
  const res = fakeResponse();
  await handler(fakeRequest({ method: 'OPTIONS', body: undefined, headers: { host: 'amu-api.onrender.com', origin: 'https://campaign.vercel.app' } }), res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['access-control-allow-origin'], 'https://campaign.vercel.app');
  assert.equal(res.headers['access-control-allow-methods'], 'POST, OPTIONS');
});

test('Render HTTP service starts and exposes a root service descriptor', async (t) => {
  const server = createBackendServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.service, 'amu-campaign-api');
  assert.equal(data.health, '/api/health');
});

test('GET to the contribution endpoint is rejected with Allow: POST', async () => {
  const res = fakeResponse();
  await handler(fakeRequest({ method: 'GET' }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
});
