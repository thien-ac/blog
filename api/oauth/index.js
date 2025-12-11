
export default async function handler(req, res) {
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const siteUrl = process.env.SITE_URL;

  // Validate env sớm để không tạo URL sai
  if (!client_id || !client_secret || !siteUrl) {
    return res.status(500).json({
      error: 'MissingEnv',
      message: 'Required env vars are missing',
      missing: {
        OAUTH_CLIENT_ID: !client_id,
        OAUTH_CLIENT_SECRET: !client_secret,
        SITE_URL: !siteUrl,
      },
    });
  }

  // Nếu dùng chung endpoint cho authorize + callback
  const redirect_uri = `${siteUrl}/api/oauth`;

  const { code } = req.query;

  // Chưa có "code" -> chuyển hướng tới GitHub OAuth
  if (!code) {
    const githubAuthURL =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(client_id)}` +
      `&scope=${encodeURIComponent('repo,user')}` +
      `&redirect_uri=${encodeURIComponent(redirect_uri)}`;
    return res.redirect(githubAuthURL);
  }

  // Có "code" -> đổi lấy access token
  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return res.status(400).json({
      error: tokenData.error,
      description: tokenData.error_description,
    });
  }

  // Chuẩn hóa response theo kỳ vọng của Decap CMS
  const token = tokenData.access_token || tokenData.token;
  return res.json(token ? { token } : tokenData);
}
