
// /api/oauth/index.js
export const config = { runtime: 'nodejs' };

import crypto from 'crypto';

function makeState(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

export default async function handler(req, res) {
  try {
    const siteUrl   = process.env.SITE_URL;
    const client_id = process.env.OAUTH_CLIENT_ID;
    const scope     = process.env.OAUTH_SCOPE || 'repo';
    const host      = process.env.OAUTH_HOSTNAME || 'github.com';

    if (!client_id || !siteUrl) {
      console.error('MissingEnv', { client_id: !!client_id, siteUrl: !!siteUrl });
      return res.status(500).json({
        error: 'MissingEnv',
        missing: { OAUTH_CLIENT_ID: !client_id, SITE_URL: !siteUrl }
      });
    }

    const origin = (req.query.origin && String(req.query.origin)) || siteUrl;
    const state  = makeState(16);

    // ⚠ Nếu đang test HTTP (localhost), hãy xóa `Secure;`
    res.setHeader('Set-Cookie', [
      `oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
      `oauth_origin=${encodeURIComponent(origin)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
    ]);

    const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(origin)}`;

    const authorizeUrl = new URL(`https://${host}/login/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', client_id);
    authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', state);

    console.log('Authorize URL:', authorizeUrl.toString());
    res.status(302).setHeader('Location', authorizeUrl.toString()).end();
  } catch (err) {
    console.error('OAuth start crash:', err);
    res.status(500).json({ error: 'ServerError', message: err?.message || String(err) });
  }
}
