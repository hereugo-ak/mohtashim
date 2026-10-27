/**
 * Server-backed contribution repository. All submissions go through the same-origin
 * Vercel API; the privileged Supabase key never reaches this module or the browser.
 */
const API_BASE_URL = String(import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

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

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/contributions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return { ok: false, mode: 'remote', code: 'network_error' };
  }

  let result = null;
  try { result = await response.json(); } catch { /* handled as a safe generic failure */ }

  if (!response.ok || result?.ok !== true || result?.status !== 'received') {
    return {
      ok: false,
      mode: 'remote',
      code: result?.error?.code || (response.status === 429 ? 'rate_limited' : 'submission_failed'),
      status: response.status,
      message: typeof result?.error?.message === 'string' ? result.error.message : '',
    };
  }

  return {
    ok: true,
    mode: 'remote',
    id: result.id,
    createdAt: result.createdAt,
    reference: result.reference,
  };
}
