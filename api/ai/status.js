// /api/ai/status.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'MethodNotAllowed' });
    return res.json({ ok: true, service: 'ai', status: 'ready', timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('/api/ai/status error', e && (e.message || e));
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
