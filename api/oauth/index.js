
export default async function handler(req, res) {
  const client_id = process.env.OAUTH_CLIENT_ID;
  const client_secret = process.env.OAUTH_CLIENT_SECRET;
  const redirect_uri = `${process.env.SITE_URL}/api/oauth`;

  const { code } = req.query;

  // Nếu chưa có "code" -> chuyển hướng tới GitHub OAuth
  if (!code) {
    const githubAuthURL =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(client_id)}` +
      `&scope=${encodeURIComponent('repo,user')}` +
      `&redirect_uri=${encodeURIComponent(redirect_uri)}`;
    return res.redirect(githubAuthURL);
  }

  // Đổi "code" lấy access token từ GitHub
  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri
    })
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return res.status(400).json({ error: tokenData.error, description: tokenData.error_description });
  }

  // Trả token cho Decap CMS (frontend sẽ lưu và dùng các API GitHub qua token này)
  return res.json(tokenData);
}
