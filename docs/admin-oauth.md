# Kết nối Decap CMS (Admin) với GitHub OAuth

Hướng dẫn cấu hình GitHub OAuth để đăng nhập vào phần quản trị (Decap CMS) của dự án.

1) Tạo OAuth App trên GitHub
- Vào GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
- Application name: (ví dụ) `My Blog Admin`.
- Homepage URL: `SITE_URL` (ví dụ `https://blog.thien.ac` hoặc `http://localhost:3000` khi local).
- Authorization callback URL: `${SITE_URL}/api/oauth/callback` (ví dụ `https://blog.thien.ac/api/oauth/callback`).
- Tạo app và ghi lại `Client ID` và `Client Secret`.

2) Thiết lập biến môi trường
- Đặt các biến môi trường sau trên hosting của bạn (Vercel/Netlify/Render/...) trong phần Environment Variables:
  - `OAUTH_CLIENT_ID` = (Client ID từ GitHub)
  - `OAUTH_CLIENT_SECRET` = (Client Secret từ GitHub)
  - `SITE_URL` = `https://your-site.example` (base URL của trang, KHÔNG có `/` cuối)
  - (tuỳ chọn) `OAUTH_HOSTNAME` = `github.com` (dùng nếu GitHub Enterprise khác hostname)

- Lưu ý: `public/admin/config.yml` đang dùng `${OAUTH_CLIENT_ID}` cho `auth.client_id`, vì vậy bạn cần rebuild site sau khi đặt biến (hoặc đảm bảo hệ thống deploy của bạn thay thế biến vào file public).

3) Thử nghiệm local
- Khi phát triển local, khởi chạy dev server:

```bash
pnpm i
pnpm dev
```

- Cách cung cấp biến môi trường cho local (tạm thời):

```bash
export OAUTH_CLIENT_ID=... \
export OAUTH_CLIENT_SECRET=... \
export SITE_URL=http://localhost:3000
pnpm dev
```

- Lưu ý về cookie Secure flag: API `/api/oauth` mặc định chỉ thêm `Secure` nếu `SITE_URL` bắt đầu bằng `https://`. Khi dùng `http://localhost` cookie vẫn được gửi (không có `Secure`) để tiện chạy local.

4) Tra cứu & kiểm tra
- Mở `/admin` và bấm **Đăng nhập GitHub**.
- Popup sẽ mở `/api/oauth/index` → chuyển hướng tới GitHub → sau khi xác thực sẽ trả về `/api/oauth/callback` và gửi token về trang `/admin` bằng `postMessage`.
- Nếu được, Decap CMS sẽ nhận payload và bạn sẽ vào dashboard.

5) Gợi ý bảo mật & triển khai
- Làm mới `OAUTH_CLIENT_SECRET` nếu nghi ngờ lộ.
- Đảm bảo `SITE_URL` chính xác và callback URL khớp với cấu hình trên GitHub OAuth App.
- Trên nền tảng deploy (Vercel/Netlify), thêm biến môi trường cho cả Production và Preview (và Development nếu muốn).

Nếu bạn muốn, mình có thể giúp tạo `.env.example`, cập nhật README và kiểm tra quy trình đăng nhập trên môi trường local hoặc deploy preview của bạn.