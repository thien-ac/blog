
export const config = { runtime: 'nodejs' };

function rand(n = 16) {
  return [...crypto.getRandomValues(new Uint8Array(n))]
    .map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

export default async function handler(req, res) {
  try {
    const siteUrl   = process.env.SITE_URL;   // ví dụ: https://blog.thien.ac
    const client_id = process.env.OAUTH_CLIENT_ID;
    const scope     = process.env.OAUTH_SCOPE || 'repo';
    const host      = process.env.OAUTH_HOSTNAME || 'github.com';

    if (!client_id || !siteUrl) {
      return res.status(500).json({
        error: 'MissingEnv',
        missing: { OAUTH_CLIENT_ID: !client_id, SITE_URL: !siteUrl }
      });
    }

    const origin = (req.query.origin && String(req.query.origin)) || siteUrl;

    const stateRaw = rand(16);
    res.setHeader('Set-Cookie', [
      `oauth_state=${encodeURIComponent(stateRaw)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
      `oauth_origin=${encodeURIComponent(origin)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
    ]);

    const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(origin)}`;
    const authorizeUrl = new URL(`https://${host}/login/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', client_id);
    authorizeUrl.searchParams.set('redirect_uri', redirect_uri);
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', stateRaw);

    res.status(302).setHeader('Location', authorizeUrl.toString()).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ServerError', message: err.message });
  }
}
