
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const client_id     = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const siteUrl       = process.env.SITE_URL; // ví dụ: https://blog.thien.ac
  const host          = process.env.OAUTH_HOSTNAME || 'github.com';

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
  if (!code) return res.status(400).json({ error: 'MissingCode', message: 'OAuth "code" is required' });

  // Parse cookies an toàn
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(v => {
      const i = v.indexOf('=');
      if (i === -1) return [v.trim(), ''];
      const k = v.slice(0, i).trim();
      const val = v.slice(i + 1).trim();
      return [k, val];
    })
  );

  let originFromCookie = '';
  try { originFromCookie = cookies['oauth_origin'] ? decodeURIComponent(cookies['oauth_origin']) : ''; } catch {}
  const originFromQuery = (req.query.origin && String(req.query.origin)) || '';
  const targetOrigin    = originFromQuery || originFromCookie || siteUrl;

  let savedState = '';
  try { savedState = cookies['oauth_state'] ? decodeURIComponent(cookies['oauth_state']) : ''; } catch {}
  if (!savedState || savedState !== state) {
    // Production nên chặn:
    return res.status(400).json({ error: 'StateMismatch', savedState, state });
  }

  const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(targetOrigin)}`;

  // 1) Đổi code lấy access_token
  let tokenData;
  try {
    const params = new URLSearchParams({ client_id, client_secret, code, redirect_uri });
    const tokenResp = await fetch(`https://${host}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenResp.ok) {
      const raw = await tokenResp.text();
      return res.status(tokenResp.status).json({
        error: 'TokenExchangeFailed',
        status: tokenResp.status,
        body: raw,
      });
    }

    try {
      tokenData = await tokenResp.json();
    } catch {
      const raw = await tokenResp.text();
      return res.status(502).json({ error: 'TokenParseFailed', body: raw });
    }
  } catch (e) {
    return res.status(502).json({ error: 'TokenExchangeError', message: e.message });
  }

  if (tokenData.error) {
    return res.status(400).json({ error: tokenData.error, description: tokenData.error_description });
  }

  const token = tokenData.access_token || tokenData.token;
  if (!token) return res.status(400).json({ error: 'NoAccessToken', details: tokenData });

  // 2) Các format message cho Decap/Netlify
  const jsonPayload = JSON.stringify({ token, provider: 'github', backend: 'github', state });

   const formats = [
    `authorization:github:success:${jsonPayload}`, // Decap v3
    `netlify-cms-oauth-provider:${jsonPayload}`,   // Netlify CMS provider cũ
    `authorization:github:success:${token}`,       // token chuỗi
    `authorization:github:access_token:${token}`,  // biến thể
  ];

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Hoàn tất đăng nhập</title>
  <meta name="robots" content="noindex"/>
  <style>
    body{font-family:system-ui;-webkit-font-smoothing:antialiased;margin:2rem;line-height:1.5}
    code,pre{background:#f6f8fa;padding:.75rem;border-radius:8px;display:block;overflow:auto}
  </style>
</head>
<body>
  <h1>Đăng nhập GitHub thành công</h1>
  <p>Đang gửi token về cửa sổ CMS (nhiều lần để đảm bảo nhận). Mở Console của trang <code>/admin</code> để quan sát.</p>
  <h3>origin</h3>
  <pre>${targetOrigin}</pre>

  <script>
    (function () {
      var origin = ${JSON.stringify(targetOrigin)};
      var msgs = ${JSON.stringify(formats)};
      var attempts = 0;

      function sendOnce() {
        var ok = false;
        function _send(target) {
          try {
            if (target && typeof target.postMessage === 'function') {
              for (var i=0; i<msgs.length; i++) { target.postMessage(msgs[i], origin); }
              ok = true;
            }
          } catch (e) { console.error('postMessage error:', e); }
        }
        if (window.opener && !window.opener.closed) _send(window.opener);
        if (!ok && window.parent && window.parent !== window) _send(window.parent);
        return ok;
      }

      var timer = setInterval(function(){
        attempts++;
        var ok = sendOnce();
        if (attempts >= 12) clearInterval(timer);
      }, 500);
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
