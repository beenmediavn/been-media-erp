V8.0.2
- Mật khẩu Admin chính ban đầu: 181096.
- Mật khẩu Admin không còn ghi cố định 123456 trong màn đăng nhập.
- Admin có thể đổi mật khẩu tại Cài đặt > Mật khẩu Admin chính.
- Không cho tạo tài khoản nhân sự tên "admin".
- Không cho trùng tên đăng nhập, kể cả khác chữ HOA/thường.
- Có unique index ở Supabase để chống trùng ngay cả khi nhiều Admin tạo cùng lúc.
- Tài khoản nhân sự mới không còn tự điền mật khẩu 123456; Admin phải nhập mật khẩu khi tạo.
BẮT BUỘC: chạy UPDATE_V8_0_2_ADMIN_PASSWORD_USERNAME_UNIQUE.sql trong Supabase một lần.
