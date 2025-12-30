
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

    // Allow fake OAuth for local dev
    const useFake = process.env.DEV_USE_FAKE_OAUTH === '1';

    if (!useFake && (!client_id || !siteUrl)) {
      console.error('MissingEnv', { client_id: !!client_id, siteUrl: !!siteUrl });
      return res.status(500).json({
        error: 'MissingEnv',
        missing: { OAUTH_CLIENT_ID: !client_id, SITE_URL: !siteUrl }
      });
    }

    const origin = (req.query.origin && String(req.query.origin)) || siteUrl;
    const state  = makeState(16);

    // Nếu SITE_URL là HTTPS thì thêm flag Secure; để an toàn.
    // Ngược lại (ví dụ `http://localhost`) không thêm Secure để cookie được chấp nhận khi dev.
    var secureFlag = siteUrl && siteUrl.toLowerCase().startsWith('https://') ? 'Secure; ' : '';
    res.setHeader('Set-Cookie', [
      `oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; SameSite=Lax; ${secureFlag}HttpOnly`,
      `oauth_origin=${encodeURIComponent(origin)}; Path=/; Max-Age=600; SameSite=Lax; ${secureFlag}HttpOnly`,
    ]);

    if (useFake) {
      // Fake OAuth: directly redirect to callback with fake code
      const fakeCode = 'fake_code_' + state;
      const redirect_uri = `${siteUrl}/api/oauth/callback?code=${fakeCode}&state=${state}&origin=${encodeURIComponent(origin)}`;
      console.log('Fake OAuth redirect:', redirect_uri);
      res.status(302).setHeader('Location', redirect_uri).end();
    } else {
      const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(origin)}`;

      const authorizeUrl = new URL(`https://${host}/login/oauth/authorize`);
      authorizeUrl.searchParams.set('client_id', client_id);
      authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
      authorizeUrl.searchParams.set('scope', scope);
      authorizeUrl.searchParams.set('state', state);

      console.log('Authorize URL:', authorizeUrl.toString());
      res.status(302).setHeader('Location', authorizeUrl.toString()).end();
    }
  } catch (err) {
    console.error('OAuth start crash:', err);
    res.status(500).json({ error: 'ServerError', message: err?.message || String(err) });
  }
}
