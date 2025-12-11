
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

  // redirect_uri PHẢI khớp với Authorization callback URL trong GitHub OAuth App
  const redirect_uri = `${siteUrl}/api/oauth/callback`;

  // 1) Đổi code lấy access_token từ GitHub
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

  // 2) Chuẩn hoá payload theo format mà Decap CMS chờ:
  //    'authorization:github:success:<JSON>'
  //    JSON nên có ít nhất { token }, tuỳ biến thêm provider/backend nếu muốn.
  const content = {
    token,
    provider: 'github',
    backend: 'github',
    state, // tuỳ chọn: phục vụ kiểm tra CSRF phía client nếu bạn có lưu state
  };

  const message = `authorization:github:success:${JSON.stringify(content)}`;

  // Lưu ý: target origin nên là domain trang admin để an toàn.
  // Nếu bạn cần linh hoạt trong thử nghiệm, có thể dùng '*', nhưng khuyến nghị là siteUrl.
  const targetOrigin = siteUrl;

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Authenticating…</title></head>
<body>
  <p>Đăng nhập thành công. Cửa sổ sẽ tự đóng…</p>
  <script>
    (function() {
      var msg = ${JSON.stringify(message)};
      var origin = ${JSON.stringify(targetOrigin)};

      try {
        if (window.opener && !window.opener.closed && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage(msg, origin);
        } else if (window.parent && window.parent !== window && typeof window.parent.postMessage === 'function') {
          window.parent.postMessage(msg, origin);
        }
      } catch (e) {
        // để debug nếu cần
        console.error('postMessage error:', e);
      }

      // Đợi một chút cho CMS xử lý rồi đóng popup
      setTimeout(function(){ window.close(); }, 500);
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
