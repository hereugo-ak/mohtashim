import { createServer } from 'node:http';
import { contributionRoute } from './serverRoutes.js';

const MAX_BODY_BYTES = 12 * 1024;

function sendJson(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, max-age=0',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let total = 0;
  let tooLarge = false;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    if (!tooLarge) chunks.push(chunk);
  }
  if (tooLarge) {
    const error = new Error('payload_too_large');
    error.statusCode = 413;
    throw error;
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return undefined;
  try { return JSON.parse(text); } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

function makeResponseAdapter(nodeRes) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = { name, value };
    },
    status(code) { this.statusCode = code; return this; },
    json(value) {
      if (nodeRes.headersSent) return this;
      const headers = Object.fromEntries(Object.values(this.headers).map(({ name, value: headerValue }) => [name, headerValue]));
      headers['Content-Type'] ||= 'application/json; charset=utf-8';
      headers['Cache-Control'] ||= 'no-store, max-age=0';
      nodeRes.writeHead(this.statusCode, headers);
      nodeRes.end(JSON.stringify(value));
      return this;
    },
    end(body = '') {
      if (nodeRes.headersSent) return this;
      const headers = Object.fromEntries(Object.values(this.headers).map(({ name, value: headerValue }) => [name, headerValue]));
      nodeRes.writeHead(this.statusCode, headers);
      nodeRes.end(body);
      return this;
    },
  };
}

export function createBackendServer() {
  return createServer(async (incoming, outgoing) => {
    const requestUrl = new URL(incoming.url || '/', `http://${incoming.headers.host || 'localhost'}`);
    if (requestUrl.pathname === '/' && incoming.method === 'GET') {
      return sendJson(outgoing, 200, {
        service: 'amu-campaign-api',
        health: '/api/health',
        submissions: '/api/contributions',
      });
    }
    if (!['/api/health', '/api/contributions'].includes(requestUrl.pathname)) {
      incoming.resume();
      return sendJson(outgoing, 404, { ok: false, error: { code: 'not_found', message: 'Route not found.' } });
    }

    let body;
    if (incoming.method !== 'OPTIONS' && requestUrl.pathname === '/api/contributions' && String(incoming.headers['content-type'] || '').toLowerCase().includes('application/json')) {
      const declaredLength = Number(incoming.headers['content-length'] || 0);
      if (declaredLength > MAX_BODY_BYTES) {
        incoming.resume();
        return sendJson(outgoing, 413, { ok: false, error: { code: 'payload_too_large', message: 'Your contribution is too large. Shorten it and try again.' } });
      }
      try { body = await readJsonBody(incoming); } catch (error) {
        const status = error.statusCode === 413 ? 413 : 400;
        return sendJson(outgoing, status, {
          ok: false,
          error: {
            code: status === 413 ? 'payload_too_large' : 'invalid_json',
            message: status === 413 ? 'Your contribution is too large. Shorten it and try again.' : 'The form could not be read. Please try again.',
          },
        });
      }
    } else if (incoming.method !== 'OPTIONS' && requestUrl.pathname === '/api/contributions') {
      incoming.resume();
    }

    const responseAdapter = makeResponseAdapter(outgoing);
    try {
      const adaptedRequest = { method: incoming.method, headers: incoming.headers, body, socket: incoming.socket };
      await contributionRoute(requestUrl.pathname, adaptedRequest, responseAdapter);
      if (!outgoing.headersSent) sendJson(outgoing, 500, { ok: false, error: { code: 'internal_error', message: 'An unexpected error occurred.' } });
    } catch {
      // Deliberately do not log request data or personally identifying fields.
      sendJson(outgoing, 500, { ok: false, error: { code: 'internal_error', message: 'An unexpected error occurred.' } });
    }
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const port = Number(process.env.PORT || 10000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createBackendServer();
  server.listen(port, host, () => {
    console.log(`AMU campaign API listening on ${host}:${port}`);
  });
}
