
export const config = { runtime: 'nodejs' };

function randomState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default async function handler(req, res) {
  const client_id = process.env.OAUTH_CLIENT_ID;
  const siteUrl   = process.env.SITE_URL;
  const scope     = 'repo,user';

  if (!client_id || !siteUrl) {
    return res.status(500).json({ error: 'MissingEnv' });
  }

  const origin = (req.query.origin && String(req.query.origin)) || siteUrl;
  const state  = randomState();

  // Thêm flag Secure cho môi trường HTTPS; bỏ Secure khi dev trên HTTP (localhost)
  var secureFlag = siteUrl && siteUrl.toLowerCase().startsWith('https://') ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', [
    `oauth_state=${encodeURIComponent(state)}; Path=/; Max-Age=600; SameSite=Lax; ${secureFlag}HttpOnly`,
    `oauth_origin=${encodeURIComponent(origin)}; Path=/; Max-Age=600; SameSite=Lax; ${secureFlag}HttpOnly`,
  ]);

  const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(origin)}`;

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', client_id);
  authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  return res.redirect(authorizeUrl.toString());
}
