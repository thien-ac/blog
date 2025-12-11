
// /api/oauth/callback.js (Vercel Serverless Function)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const client_id     = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const siteUrl       = process.env.SITE_URL; // ví dụ: https://blog.thien.ac

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

  // Content mà CMS cần
  const content = { token, provider: 'github', backend: 'github', state };

  // Hai format message thường gặp
  const msgDecap   = `authorization:github:success:${JSON.stringify(content)}`;
  const msgNetlify = `netlify-cms-oauth-provider:${JSON.stringify(content)}`;

  // Ưu tiên gửi về đúng origin của trang admin
  const safeOrigin = siteUrl;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authenticating…</title></head>
<body>
  <p>Đăng nhập thành công. Đang chuyển về CMS…</p>
  <script>
    (function() {
      var msg1 = ${JSON.stringify(msgDecap)};
      var msg2 = ${JSON.stringify(msgNetlify)};
      var origin = ${JSON.stringify(safeOrigin)};

      function tryPostMessage(target) {
        try {
          if (target && typeof target.postMessage === 'function') {
            // Gửi 2 thông điệp để tối đa khả năng CMS bắt được
            target.postMessage(msg1, origin);
            target.postMessage(msg2, origin);
            return true;
          }
        } catch (e) {
          console.error('postMessage error:', e);
        }
        return false;
      }

      var posted = false;
      // 1) window.opener trước
      if (window.opener && !window.opener.closed) {
        posted = tryPostMessage(window.opener);
      }
      // 2) nếu không, thử window.parent (trường hợp mở trong iframe)
      if (!posted && window.parent && window.parent !== window) {
        posted = tryPostMessage(window.parent);
      }

      // 3) Nếu vẫn không được, thử gửi với targetOrigin='*' (chỉ để TEST)
      if (!posted) {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(msg1, '*');
            window.opener.postMessage(msg2, '*');
            posted = true;
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(msg1, '*');
            window.parent.postMessage(msg2, '*');
            posted = true;
          }
        } catch (e) {}
      }

      // Cho CMS thời gian xử lý rồi đóng popup
      setTimeout(function(){ window.close(); }, 800);
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
