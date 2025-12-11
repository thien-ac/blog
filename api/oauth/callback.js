
// /api/oauth/callback.js (Vercel Serverless Function)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const client_id     = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const siteUrl       = process.env.SITE_URL;                 // ví dụ: https://blog.thien.ac
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
  if (!code) {
    return res.status(400).json({ error: 'MissingCode', message: 'OAuth "code" is required' });
  }

  // Lấy origin từ query hoặc cookie
  const cookieHeader     = req.headers.cookie || '';
  const cookieOriginRaw  = (cookieHeader.match(/(?:^|;\s*)oauth_origin=([^;]+)/) || [])[1];
  const originFromCookie = cookieOriginRaw ? decodeURIComponent(cookieOriginRaw) : '';
  const originFromQuery  = (req.query.origin && String(req.query.origin)) || '';
  const targetOrigin     = originFromQuery || originFromCookie || siteUrl;

  // Xác thực state đơn giản
  const cookieStateRaw = (cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/) || [])[1];
  const savedState     = cookieStateRaw ? decodeURIComponent(cookieStateRaw) : '';
  if (!savedState || savedState !== state) {
    console.warn('State mismatch:', { savedState, state });
  }

  // redirect_uri phải khớp với Authorization callback URL trong GitHub OAuth App
  const redirect_uri = `${siteUrl}/api/oauth/callback?origin=${encodeURIComponent(targetOrigin)}`;

  // 1) Đổi code lấy access_token
  let tokenData;
  try {
    const tokenResp = await fetch(`https://${host}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({ client_id, client_secret, code, redirect_uri }),
    });
    tokenData = await tokenResp.json();
  } catch (e) {
    return res.status(502).json({ error: 'TokenExchangeFailed', message: e.message });
  }

  if (tokenData.error) {
    return res.status(400).json({
      error: tokenData.error,
      description: tokenData.error_description,
    });
  }

  const token = tokenData.access_token || tokenData.token;
  if (!token) return res.status(400).json({ error: 'NoAccessToken', details: tokenData });

  // 2) Chuẩn hoá payload theo format mà Decap chờ
  const content    = { token, provider: 'github', backend: 'github', state };
  const msgDecap   = `authorization:github:success:${JSON.stringify(content)}`;
  const msgNetlify = `netlify-cms-oauth-provider:${JSON.stringify(content)}`; // dự phòng

  // 3) Trả về HTML: postMessage tới cửa sổ cha, KHÔNG tự đóng popup
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
  <p>Mình đã gửi token về cửa sổ CMS. Nếu CMS chưa chuyển, vui lòng kiểm tra Console của trang <code>/admin</code>.</p>

  <h3>Thông tin gửi đi</h3>
  <pre id="payload"></pre>
  <pre id="status"></pre>

  <script>
    (function () {
      var origin = ${JSON.stringify(targetOrigin)};
      var msg1 = ${JSON.stringify(msgDecap)};
      var msg2 = ${JSON.stringify(msgNetlify)};
      var statusEl = document.getElementById('status');
      var payloadEl = document.getElementById('payload');

      payloadEl.textContent = 'origin: ' + origin + '\\n\\n' + msg1;

      function send(target) {
        try {
          if (target && typeof target.postMessage === 'function') {
            target.postMessage(msg1, origin);
            target.postMessage(msg2, origin);
            statusEl.textContent = 'Đã gửi postMessage tới ' + origin;
            return true;
          }
        } catch (e) { console.error('postMessage error:', e); statusEl.textContent = 'Lỗi postMessage: ' + e.message; }
        return false;
      }

      var ok = false;
      if (window.opener && !window.opener.closed) ok = send(window.opener);
      if (!ok && window.parent && window.parent !== window) ok = send(window.parent);

      // (Tuỳ chọn TEST) Nếu vẫn không được, thử '*' để kiểm tra listener — nên bỏ khi production
      if (!ok) {
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(msg1, '*'); window.opener.postMessage(msg2, '*'); ok = true;
            statusEl.textContent += '\\nĐã thử gửi với targetOrigin=* (chỉ để test).';
          } else if (window.parent && window.parent !== window) {
            window.parent.postMessage(msg1, '*'); window.parent.postMessage(msg2, '*'); ok = true;
            statusEl.textContent += '\\nĐã thử gửi với targetOrigin=* (chỉ để test).';
          }
        } catch (e) {}
      }

      // KHÔNG tự đóng popup nữa – để người dùng xem trạng thái/console.
    })();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
