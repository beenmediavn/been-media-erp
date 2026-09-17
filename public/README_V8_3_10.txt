BEEN MEDIA ERP V8.3.10

FIX 1 - NHẬP GIỜ TRÊN ĐIỆN THOẠI
- Ô giờ Job dùng bàn phím số.
- Gõ 1535 => tự hiển thị 15:35.
- Không còn lỗi 1:535.
- Áp dụng cho tạo/sửa Job, tạo lịch nhanh và Thợ dự phòng.

FIX 2 - CHẤM CÔNG
- Mở quyền Chấm công cho toàn bộ tài khoản nhân viên (Điều phối, Chụp, Quay, Editor, Kế toán, Viewer) khi có Job được phân công.
- Có camera trực tiếp.
- Thêm nút “CHỤP BẰNG CAMERA ĐIỆN THOẠI” làm phương án chắc chắn trên Android/iPhone.
- Nếu trình duyệt chặn getUserMedia, người dùng vẫn bấm nút camera điện thoại để chụp và upload.
- Check-in mặt -> ảnh cùng khách -> Check-out.
- Admin xem ảnh, giờ, trạng thái và số phút muộn.
- Có thông báo lỗi rõ nếu database Chấm công chưa được cài.

SQL
- Nếu Chấm công chưa từng hoạt động, chạy UPDATE_V8_3_10_ATTENDANCE_MOBILE_TIME_FIX.sql trong Supabase SQL Editor 1 lần.
