// /api/ai/status.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const key = process.env.OPENAI_API_KEY;
    const enabled = !!(key && key !== 'dev-key') || process.env.DEV_USE_FAKE_OPENAI === '1';

    res.status(200).json({
      enabled,
      models: enabled ? ['gpt-4o-mini', 'gpt-4'] : [],
      providers: enabled ? ['openai'] : []
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: err.message || String(err) });
  }
}