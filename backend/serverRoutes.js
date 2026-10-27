import contributionHandler from '../api/contributions.js';
import healthHandler from '../api/health.js';

const ROUTES = new Map([
  ['/api/contributions', contributionHandler],
  ['/api/health', healthHandler],
]);

export async function contributionRoute(pathname, req, res) {
  const handler = ROUTES.get(pathname);
  if (!handler) return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Route not found.' } });
  return handler(req, res);
}
