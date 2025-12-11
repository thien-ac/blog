
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const client_id     = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const siteUrl       = process.env.SITE_URL;

  if (!client_id || !client_secret || !siteUrl) {
    return res.status(500).json({
      error: 'MissingEnv',
      message: 'Required env vars are missing in /api/oauth/callback',
      missing: {
        OAUTH_CLIENT_ID: !client_id,
        OAUTH_CLIENT_SECRET: !client_secret,
        SITE_URL: !siteUrl,
      },
    });
  }

  const { code, state } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'MissingCode', message: 'OAuth "code" is required' });
  }

  const redirect_uri = `${siteUrl}/api/oauth/callback`;

  const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams({ client_id, client_secret, code, redirect_uri }),
  });
  const tokenData = await tokenResp.json();

  if (tokenData.error) {
    return res.status(400).json({
      error: tokenData.error,
      description: tokenData.error_description,
    });
  }

  const token = tokenData.access_token || tokenData.token;
  if (!token) return res.status(400).json({ error: 'NoAccessToken', details: tokenData });

  // Nếu Decap mở trong popup, gửi token về cửa sổ cha và đóng popup
  const target = siteUrl || '*';
  const html = `<!doctype html>
  <html><head><meta charset="utf-8"><title>Authenticating…</title></head>
  <body>
    <script>
      (function() {
        var token = ${JSON.stringify(token)};
        try {
          // Gửi token về cửa sổ cha
          if (window.opener) {
            window.opener.postMessage({ token: token }, '${target}');
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage({ token: token }, '${target}');
          }
        } catch (e) {}
        // Tự động đóng popup sau khi gửi
        setTimeout(function(){ window.close(); }, 100);
      })();
    </script>
    <p>Đăng nhập thành công. Bạn có thể đóng cửa sổ này.</p>
  </body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
