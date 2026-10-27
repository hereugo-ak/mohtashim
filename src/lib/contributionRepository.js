/**
 * Server-backed contribution repository. All submissions go through the same-origin
 * Vercel API; the privileged Supabase key never reaches this module or the browser.
 */
const API_BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

const SUBMIT_TIMEOUT_MS = 12000;
const RETRY_SUBMIT_TIMEOUT_MS = 30000;
const WAKE_BUDGET_MS = 66000;
const WAKE_POLL_INTERVAL_MS = 4500;

/** Single health ping. Returns true only when the API answers 200 ok. */
export async function pingBackend(timeoutMs = 8000) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return false;
  }
  let result = null;
  try { result = await response.json(); } catch { /* treat as not ready */ }
  return response.ok && result?.ok === true;
}

/**
 * Wake a cold-started service: poll the health endpoint until it responds ok
 * or the time budget runs out. Render cold starts usually land within 30-60s.
 */
async function wakeBackend(budgetMs = WAKE_BUDGET_MS) {
  const started = Date.now();
  while (Date.now() - started < budgetMs) {
    if (await pingBackend(9000)) return true;
    await new Promise((resolve) => setTimeout(resolve, WAKE_POLL_INTERVAL_MS));
  }
  return false;
}

async function sendContribution(payload, timeoutMs) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/contributions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // A timeout abort is ambiguous: the server may have processed the request,
    // so it is never retried automatically. A clean connection failure means
    // the request never arrived, which is safe to recover from.
    return { kind: 'network_error', timedOut: error?.name === 'TimeoutError' };
  }

  let result = null;
  try { result = await response.json(); } catch { /* handled as a safe generic failure */ }

  if (!response.ok || result?.ok !== true || result?.status !== 'received') {
    return {
      kind: 'rejected',
      code: result?.error?.code || (response.status === 429 ? 'rate_limited' : 'submission_failed'),
      status: response.status,
      message: typeof result?.error?.message === 'string' ? result.error.message : '',
    };
  }

  return {
    kind: 'received',
    id: result.id,
    createdAt: result.createdAt,
    reference: result.reference,
  };
}

export async function saveContribution(note, protections = {}) {
  const payload = {
    faculty: note.faculty,
    topic: note.topic,
    details: note.details || '',
    studentName: note.anonymous ? null : note.name,
    className: note.anonymous ? null : note.className,
    anonymous: Boolean(note.anonymous),
    website: protections.website || '',
  };

  const first = await sendContribution(payload, SUBMIT_TIMEOUT_MS);
  if (first.kind === 'received') {
    return { ok: true, mode: 'remote', id: first.id, createdAt: first.createdAt, reference: first.reference };
  }
  if (first.kind === 'rejected') {
    return { ok: false, mode: 'remote', code: first.code, status: first.status, message: first.message };
  }

  // Network failure: the service is probably asleep. Wake it, then retry once
  // when the failure was a clean connection error (no duplicate-submission risk).
  const wake = wakeBackend();

  if (first.timedOut) {
    await wake;
    return { ok: false, mode: 'remote', code: 'network_error' };
  }

  const awake = await wake;
  const second = await sendContribution(payload, RETRY_SUBMIT_TIMEOUT_MS);
  if (second.kind === 'received') {
    return { ok: true, mode: 'remote', id: second.id, createdAt: second.createdAt, reference: second.reference };
  }
  if (second.kind === 'rejected') {
    return { ok: false, mode: 'remote', code: second.code, status: second.status, message: second.message };
  }
  return { ok: false, mode: 'remote', code: 'network_error' };
}
