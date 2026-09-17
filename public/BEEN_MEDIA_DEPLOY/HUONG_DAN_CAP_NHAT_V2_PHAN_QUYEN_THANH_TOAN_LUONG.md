# BEEN MEDIA ERP v2 - Phân quyền + Thanh toán + Lương

## Tài khoản mặc định
- User: admin
- Mật khẩu: 123456

Sau khi đăng nhập, vào Nhân sự để tạo tài khoản cho từng người.

## Vai trò đã có
- Admin: toàn quyền
- Điều phối / Sale: khách hàng, lịch, job, drive
- Photographer: lịch, job, drive, lương của tôi
- Videographer: lịch, job, drive, lương của tôi
- Editor: job, drive
- Kế toán: khách hàng, thanh toán, lương, báo cáo
- Chỉ xem: dashboard, lịch, job, drive

## Cần chạy SQL trước khi dùng phân quyền
Vào Supabase -> SQL Editor -> mở file SUPABASE_SCHEMA.sql -> Run.

File này sẽ thêm các cột:
- employees.app_role
- employees.can_login
- employees.note

Và tạo tài khoản admin nếu chưa có.

## Đưa lên Vercel
Trong VS Code chạy:

git add .
git commit -m "ERP v2 role payments salary"
git push

Vercel sẽ tự deploy.

## Các nâng cấp trong bản này
- Trang đăng nhập /login
- Lưu phiên đăng nhập
- Ẩn menu theo vai trò
- Chặn trang không có quyền
- Thanh toán có lọc: Tất cả, đã thanh toán, đã cọc, chưa thanh toán, còn nợ
- Lương có lọc: Tất cả, đã trả đủ, chưa trả, còn nợ lương, đã ứng
- Hiện danh sách nhân sự còn nợ lương
- Giao diện mobile cho thanh toán và lương

## Lưu ý bảo mật
Bản này là phân quyền cấp giao diện để công ty vận hành nội bộ nhanh. Sau khi quy trình ổn định, nên nâng cấp lên Supabase Auth + RLS theo user thật để bảo mật chặt hơn.
